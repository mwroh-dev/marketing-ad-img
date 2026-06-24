# AGENTS.md

## Agent Design Principle

Agents are contracts, not code. Each agent definition must contain: Role, Inputs, Outputs, Allowed Skills, Forbidden Actions, Memory Scope, Failure Modes, Handoff Format. Agent definitions must NOT contain procedural browser steps, retry loops, or tool-invocation scripts. Execution logic belongs in skills, scripts, or the browser-flow runtime.

## Real subagents vs. blueprint agents

**19 role-scoped subagents** are instantiated as real Claude Code subagents under `agents/` (flat `agents/<name>.md`, each with `name`/`description`/`tools` frontmatter), plus the `orchestrator` entry agent (20 total). **stage** = the pipeline stage that agent implements (gate→setup→collection→analysis→generation); matches the CLAUDE.md Modes map.

| Real subagent (`agents/`) | stage | Role / Absorbs |
|---|---|---|
| `request-evaluator` | evaluation | mode/slot/blocker decision (+ source-planner mode-detection) |
| `interview-controller` | evaluation | blocker-resolution interview loop |
| `brand-researcher` | setup | initial-setup brand self-research from PUBLIC sources (page/reviews/positioning, one angle per dispatch, parallel) → evidence-grounded category/persona candidates |
| `keyword-planner` | collection | Track-1 ad-search keyword plan: expands (product, persona) across 3 axes (Needs / Use-case / Adjacency) into keyword queries — generation only, no CDP. Feeds run-flow.mjs --from-keyword-plan |
| `discovery-scout` | collection | advertiser discovery via public ad-library search (Meta/Google) + user-provided competitor seeds (search/list only, recall) |
| `competitor-curator` | collection | competitor-selection HARD GATE |
| `ad-creative-refiner` | collection | detail-cut TYPE classification on the seller's own / user-provided images (persuasive detail-cut = ad separation) |
| `perception-extractor` | analysis | the ONE vision pass: image→geometry+text + scene+look observation |
| `copy-analyst` | analysis | text-role/hook/keyword (text meaning only) |
| `layout-analyst` | analysis | composition + comfort (geometry only) |
| `visual-analyst` | analysis | visual semantics + register/mood NAMING (text-only on perception scene/look; ring 2, brand-free) |
| `intent-analyst` | analysis | persuasion strategy (appeal/funnel) + copy×layout binding MEANING (text-only on copy/layout/visual/bindings; ring 2, brand-free) |
| `ad-analyst` | analysis | keyword extraction/normalization/slot-labeling |
| `pattern-synthesizer` | analysis | per-persona ad-pattern description |
| `competitive-analyst` | analysis | per-persona competitive-trend narrative (longevity/variation/change + appeals) ON TOP of the deterministic trend aggregate |
| `creative-brief-analyst` | generation | creative brief synthesis (brand/product/persona/review/pattern projection) |
| `copy-layout-planner` | generation | per-candidate copy + layout |
| `image-prompt-adapter` | generation | provider-neutral spec → ChatGPT/Gemini prompt (+ image-adapter-* skills) |
| `critic-verifier` | generation | candidate verification gate (Agent-as-Judge) |

Data collection (D), the preprocessing slicer, pattern aggregation (deterministic), and the generation finalizer run **without an agent, via `${CLAUDE_PLUGIN_ROOT}/shared/` (harness/collect)** (by design; no dedicated collector subagent — the harness+adapter absorb that role, and the legacy `ad-library-collector` was removed). Real CDP collection from public ad-transparency libraries is canonical (public, no-login profile, STOP-on-block); the only things forbidden are bypassing and re-implementing browser-flow. Completion is decided by independent verification (`${CLAUDE_PLUGIN_ROOT}/knowledge/guidelines/completion-verification-policy.md`).

## Orchestrator

The orchestrator is NOT a subagent. It is the main-session entry agent (`${CLAUDE_PLUGIN_ROOT}/agents/orchestrator.md`, auto-activated via `settings.json` `"agent": "orchestrator"`) — the shipped entry that works when the plugin is installed elsewhere (a plugin's root `CLAUDE.md` is NOT loaded for consumers). It holds the full artifact/knowledge set and dispatches the 19 subagents, projecting only role-scoped views to each.

## Context Distribution Rule

| Subagent | Receives (projected) | Must NOT receive |
|---|---|---|
| request-evaluator | user request, mode contracts, registry summaries, interview-state | raw browser artifacts, credentials |
| interview-controller | highest-priority blocker, slot schema, interview-state, brand-researcher candidates (for choice questions) | full domain dump |
| brand-researcher | pointers (brand · product · product URL · user target memo) + ONE research angle | other brands/personas, full domain set, credentials |
| keyword-planner | product (name/category/USP), the single persona (language_cues/pains/desires), target_market, user keyword seeds | other personas, full domain set, credentials, collected creatives |
| creative-brief-analyst | brand profile, product USP/claims, persona, review evidence summary, selected global principles | raw browser artifacts, login state |
| copy-layout-planner | persona, product USP, claim constraints, selected formats, copy + layout principles | full review dump, browser-flow logs |
| image-prompt-adapter | provider-neutral CreativeCandidateSpec (incl. `style.brand_tone` + `style.avoid`), product asset metadata, exact Korean copy | all domain knowledge |
| critic-verifier | candidate claims, evidence refs, constraints | private scratchpads |
| discovery-scout | one product + one persona (cues), user seeds, surface list | full domain, other personas, credentials |
| competitor-curator | scout candidate pool, seeds, the one persona, product USP/claims | other personas' competitor sets, raw browser logs |
| ad-analyst | one persona's competitor corpus (titles+detail), persona cues, slot taxonomy, loanword seed | other personas, raw browser logs, credentials |
| perception-extractor | one ad image, persona_id | text meaning interpretation, other images |
| layout-analyst | one perception artifact (geometry), persona_id | text content meaning |
| copy-analyst | one perception artifact (text content), persona_id | coordinates/fonts |
| visual-analyst | one perception artifact (medium/scene/look), persona_id | the image itself (text-only), the brand/persona positioning (ring 3), other images |
| intent-analyst | one image's copy + layout + visual analyses + bindings, persona_id | the image itself (text-only), the brand/persona positioning + category-gap (ring 3), other images |
| pattern-synthesizer | the deterministic ad-pattern aggregate | raw images, recompute rights |
| competitive-analyst | the deterministic competitive-trend aggregate (+ optional ad-pattern copy aggregates) | raw images, recompute rights, other personas |
| ad-creative-refiner | one image (path), competitor_id, persona_id | text meaning interpretation, layout/composition analysis, other images |


## Agent file roles (process ⊥ result)
Per agent: `AGENT.md` = the declarative contract; the `## Guidelines` section = the **making PROCESS** (steps, order, considerations — how to produce the output well); the `## Verification checklist` = the **OUTPUT verification** (is the produced artifact correct). Output-checks live in the Verification checklist section, never in the Guidelines section.

## Verification — two layers (shape ⊥ logic)
An agent's output is verified at two levels; the schema validator alone is NOT sufficient for reasoning agents:
1. **Shape** — `${CLAUDE_PLUGIN_ROOT}/schemas/<stage>/` + `${CLAUDE_PLUGIN_ROOT}/shared/validators/validate-*.ts` (ajv): fields exist, types/enums match. Cheap, structural only.
2. **Logic** — the agent's `## Verification checklist`: does the *reasoning* hold (right slot judged from function, no invention, no forbidden claim, catch-rate)? Applied to the agent's ACTUAL output on real data, at self-review and independent review. A schema-valid output that fails the checklist is still a defect — the real gate for reasoning agents.

## Handoff Rule

Subagents return structured decision artifacts (JSON-compatible, schema-conformant), not full reasoning logs.
