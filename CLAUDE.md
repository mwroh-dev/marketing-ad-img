# CLAUDE.md

The **context loader and orchestrator operations manual** that Claude Code reads when entering `generate-img` (marketing-img). It keeps policy short and links to the canonical sources instead.

> **DEV-only — NOT shipped to consumers.** When this plugin is installed elsewhere, a plugin's root `CLAUDE.md` is NOT loaded into the consumer's session. The shipped entry is the **`orchestrator` agent** (`agents/orchestrator.md`, auto-activated via `settings.json` `"agent": "orchestrator"`), which carries this same entry routine self-sufficiently and resolves all plugin assets via `${CLAUDE_PLUGIN_ROOT}`. Keep this file and `agents/orchestrator.md` in sync; this file is the dev reference.

## What this is
A system for generating **ad-image creative prompts** (prompt-only) for sellers / advertisers — **domain-neutral**: the target brand/product/persona is configured per consumer at setup, NOT fixed in the system (a specific seller is one possible instance, not the definition). Media-neutral output. Ad sources are public ad-transparency libraries: **Meta Ad Library + Google Ads Transparency** (public, no login), plus analysis of the user's own / provided product images (e.g. detail-page images). user request → evaluation → interview → mode execution → image-generation **prompt candidates (4 by default)**. It does not actually generate images or call providers — **prompt-only**. Canonical boundary: `knowledge/reference/product-boundary.md` (Target & Ad Sources).

## Entry routine (every invocation) — state-first, lazy
**Do NOT pre-read all of `knowledge/` (incl. the subagent-projection table) or the design docs.** Loading the whole repo up front wastes context and tokens and is not how the harness works. The orchestrator *routes*; each mode/agent loads only its own contract when it becomes active (progressive disclosure).

1. **Check consumer state** — run `node shared/harness/check-state.mjs` (deterministic; reports setup status + the route). It reads `.generate-ads-img/`:
   - brand/product/persona (`.generate-ads-img/brands/…`)? confirmed competitors? collected ad creatives / ad-pattern?
2. **Route on state + request — do not run everything:**
   - **Setup missing** (first run, or the request targets a brand/product/persona that is not in state) → run **`initial-setup`** and stop there until it is ready. The orchestrator reads its runbook (`knowledge/reference/modes/initial-setup.md` + brand/product/persona schemas) and dispatches its steps.
   - **Setup present** → run **`request-evaluation`** to detect the mode and check *that mode's* required state/slots. Then dispatch **only that one mode**; it loads its own design doc + projects role-scoped views to its subagents.
3. No mode runs before request-evaluation reports `ready`. A subagent receives only its projected inputs — the orchestrator never hands it the full knowledge set.

### What to load, and when
| Load | When |
|---|---|
| `knowledge/reference/non-negotiable-rules.md` + `knowledge/guidelines/completion-verification-policy.md` | once at entry — small, they bind every mode |
| `knowledge/reference/subagent-projection.md` projection table | when dispatching a subagent (look up its row), not before |
| a mode's design doc (`knowledge/reference/*`, `knowledge/guidelines/*`) | only when that mode is the active one |
| an agent's contract (`agents/<name>.md`) | the subagent loads its own; the orchestrator does not |

## Modes — mode → implementation (runbook / agent / script)
A **mode** is an orchestration stage. Its procedure is a **runbook** in `knowledge/reference/modes/` that the orchestrator reads when that mode is active, then dispatches the mode's agents/scripts. Modes are NOT skills (a runbook serves one caller — the orchestrator). `skills/` holds only genuinely reusable, cross-caller skills.
| Flow/Mode | Responsibility | Implementation |
|---|---|---|
| A request-evaluation | mode/slot/blocker/ready | agent `request-evaluator` · runbook `modes/request-evaluation.md` |
| B interview | blocker-resolution state loop | agent `interview-controller` |
| (answer structuring) | raw→structured artifact | **skill** `user-answer-tooling` (reusable utility) |
| C initial-setup | brand/product/per-product persona | runbook `modes/initial-setup.md` |
| competitor gate | advertiser discovery (public ad-library search) + user-provided competitor seeds → curator (HARD GATE) | agents `discovery-scout`, `competitor-curator` |
| D collection | real collection of ad creatives from public ad-transparency libraries (Meta Ad Library, Google Ads Transparency) | runbook `modes/data-collection.md` · per-source flows in `flows/<source>/` + shared `ad-collect-harness` |
| preprocessing | detail-cut separation on the seller's own / user-provided images: long-image slicing + ad separation | `slice-long-image`, agent `ad-creative-refiner` + `refine-images` |
| analysis (typed · text⊥layout⊥visual⊥intent → strategy) | perception→ad-type-classify(route)→(copy⊥layout⊥visual)→intent→strategy-project→pattern+market-position-matrix | agents `perception-extractor`,`ad-type-classifier`,`copy-analyst`,`layout-analyst`,`visual-analyst`,`intent-analyst`,`strategy-projector`,`ad-analyst`,`pattern-synthesizer` + `keyword-rank`,`ad-pattern-rank`,`slice-stitch`,`bbox-bind`,`ad-type-registry`,`ad-type-gate`,`market-position-aggregate` · taxonomy `ad-taxonomy.md` + strategy `ad-strategy-taxonomy.md` |
| competitive-report | per-persona competitive intelligence from collected creatives across dated snapshots: longevity (run-duration = longevity proxy) + variation/cadence + new/disappeared + appeals → consumer HTML report | runbook `modes/competitive-report.md` · script `competitive-trend` (deterministic) + agent `competitive-analyst` + `render-report` (template-fill, no per-run LLM) |
| creative-change-analysis | compare persisted creative snapshots: create/delete/persisted/update + classified distribution shifts + claim-kind-separated interpretation/context hypotheses | runbook `modes/creative-change-analysis.md` · scripts `build-creative-snapshot`,`compare-creative-snapshots`,`detect-change-candidates` (deterministic) + agents `temporal-change-analyst`,`market-context-researcher` (optional) + `render-change-report` |
| validate-recipe | on-demand READ-ONLY QA viewer of the analysis we extracted: per ad (grouped by collection date) image + info + recipe (type/copy/register/benefit×funnel/cognition) shown faithfully. NO system quality verdict — the human compares each ad to its recipe and judges (the agent must not pre-grade; it can be confidently wrong). Correction is a terminal conversation (copy the ad's id → "이 광고 재분석해줘"), never an inline edit | runbook `modes/validate-recipe.md` · script `validate-recipe` (deterministic template-fill, no agent, no write) |
| generation | opportunity(ring3)→brief→copy→adapter→critic→finalizer | runbook `modes/image-generation.md` · agents `creative-opportunity-mapper`,`creative-brief-analyst`,`copy-layout-planner`,`image-prompt-adapter`,`critic-verifier` + `finalize-candidates` |

## What goes where (directory ownership — sub-agent/skill placement)
- `agents/` — subagent **contracts** (declarative; no procedural code). Logic specific to a single caller goes inside the agent or in a script.
- `skills/` — reusable skills (shared playbooks). If it serves only one caller, it does not belong in skills/.
- `shared/` — execution logic (shared): `shared/collect/` (collection · deterministic ranking/gating · slicer · acquire-port), `shared/validators/validate-*.ts`, `shared/harness/` (run-* · finalize-candidates · cutout), `shared/_lib.ts`.
- `schemas/<stage>/` — I/O contracts (per stage, recursive resolver). `knowledge/` (committed, **plugin asset**) — guidelines ⊥ experience. `config/` — plugin system config (image-adapters · cdp-ports · tool-entrypoints). `knowledge/reference/` — system design reference (former docs/).
- **Consumer state (not in the release, generated at runtime)**: `.generate-ads-img/` (consumer cwd) — brands/ · runs/ · registry/ (brands · competitors · collected ads). Scripts read and write through `shared/_lib.ts`, which distinguishes **`ROOT`=plugin asset, `STATE_DIR`=`.generate-ads-img/`**. Agents write domain facts to state, not to `knowledge/`. `.generate-ads-img/` and `tasks/` are also gitignored (dev-only).
- Reference KB: agentic-principles (`github.com/mwroh-dev/agentic-principles`) — case-law style, `Properties to Restore` criteria.

## Completion/verification discipline (no fake completion)
Completion is not an agent's self-declaration — it is **implementation robustness ∧ test robustness** (real-data execution + schema/validator PASS (shape) + the agent's `## Verification checklist` applied to real output (logic), no hollow). Canonical: `knowledge/guidelines/completion-verification-policy.md`. When hardening a new stage: define the expected behavior first → run on real data → self-review → apply the checklist → independent verification.

## Claude Execution Rules
The full hard constraints are single-owned in `knowledge/reference/non-negotiable-rules.md` (do not restate them elsewhere). Entry-critical reminders only:
- No mode runs before request-evaluation reports ready; the interview is a criteria-driven state loop (not a fixed question count); every answer is structured via `user-answer-tooling`.
- **Completion is decided by independent verification** (`knowledge/guidelines/completion-verification-policy.md`) — self-declaration is void.
- **CDP**: `shared/collect/acquire-port.mjs` first; non-intrusive; STOP-on-block; the no-URL-assembly + public-front-door whitelist is code-enforced in `ad-collect-harness.goto` (`matchToolEntry`).
