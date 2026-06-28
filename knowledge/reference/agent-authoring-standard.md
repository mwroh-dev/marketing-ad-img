# Agent-authoring standard

How to write a subagent contract (`agents/*.md`) in this plugin. The standard a restructure is measured against —
grounded in frontier-lab official guidance + the `agentic-principles` KB. **Purpose-driven, not line-count-driven:
length is never the defect; a structural violation is.**

## Official consensus (the grounding)
| Source | What it says |
|---|---|
| [Anthropic — Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | Keep the design **simple**; add complexity only when it *demonstrably* improves outcomes. Use a multi-step agent (vs one augmented LLM call) only for open-ended problems. Orchestrator **decomposes → delegates → synthesizes** (subtasks decided at runtime). Invest in the tool interface (ACI) like UX; ground truth comes from the environment, not the prompt. |
| [Claude Code — subagents](https://code.claude.com/docs/en/sub-agents) | File = frontmatter (`name`+`description` required; `tools`/`model`/`skills`/… optional) + **body = the system prompt** (the subagent gets ONLY this, not the main system prompt). "Each subagent should excel at **one specific task**." "Limit tool access." `description` is the **routing** signal. Example prompts ≈ 15–30 lines. **Shared rules in CLAUDE.md load to subagents anyway — don't restate them per agent.** |
| [OpenAI — A Practical Guide to Building AI Agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/) | Author instructions from existing SOPs → **discrete steps + explicit actions + edge-case handling**. **Start with ONE agent**; split only when it improves capability/policy isolation, prompt clarity, or trace legibility (triggers: unscalable conditional branching; tool overlap). |
| [OpenAI — agents / orchestration](https://developers.openai.com/api/docs/guides/agents) | Agent = `name` + `instructions` (job/constraints/style) + `tools` (capabilities) + `handoffs` + `outputType`. "Give each specialist a **narrow job**." Three homes for a fact: **model needs it → instructions/tool/retrieval; only runtime needs it → local context.** |
| [agents.md](https://agents.md) | The agent's detailed counterpart to README (README = humans, AGENTS.md = the agent). Per-purpose handled by **nesting**; nearest file wins. |

**Distilled rules (= our `agentic-principles`):**
1. **No length ceiling — conciseness is structural.** A 200-line agent of genuine method is fine; a 60-line agent that restates a shared policy is not.
2. **One job per agent.** Split only on evidence (isolation / clarity / branching / tool-overlap), never to hit a line target.
3. **The file holds BEHAVIOR.** Capabilities → `tools`. Separate responsibilities → another agent/handoff. **Shared rules → the canonical owner** (`non-negotiable-rules.md`, `completion-verification-policy.md`, `axis-model.md`), loaded — *not restated* (`policy-single-owner`). Runtime plumbing → code, never the prompt.
4. **Each constraint stated once** (`constraint-hierarchy-over-accumulation`) — the section scaffold must not echo the same boundary in Role + Forbidden + method + Priorities + Verification.
5. **Deterministic steps → code, not prose** (`code-over-prompt`); the agent describes only the judgment it actually makes.

## The six purpose categories
The first thing the model "sees" is the agent's PURPOSE — it dictates the shape. Our agents:

| # | Category | Agents | Intent (what the LLM is for) |
|---|---|---|---|
| 1 | **COORDINATOR** | orchestrator | route · delegate · synthesize · gate. Holds full context; projects role-scoped views. NOT a worker. |
| 2 | **INTERACTION/STATE** | request-evaluator · interview-controller | user-facing state loop over `interview-state`/blockers; read-only; criteria-driven (not question-count). |
| 3 | **PERCEPTION** | perception-extractor | the ONE vision pass — literal observe-only; everyone downstream reads its text, never the image. |
| 4 | **REASONING** | copy/layout/visual/intent/ad-type/strategy-analyst · ad-analyst · ad-creative-refiner · pattern-synthesizer · competitive-analyst · creative-opportunity-mapper | text-only judgment over an artifact; code owns numbers/ranking, the LLM owns the meaning/narrative. |
| 5 | **TOOL/BROWSER** | discovery-scout · competitor-curator · brand-researcher · keyword-planner | drive tools (CDP/web) on public sources; STOP-on-block; never fabricate → coverage_flag. |
| 6 | **GENERATION** | creative-brief-analyst · copy-layout-planner · image-prompt-adapter · critic-verifier | the prompt-only creative chain; byte-exact Korean; brand_tone-derived; forbidden-claims guarded. |

(`ad-image-screener` = DEPRECATED, not dispatched.)

## Canonical skeleton (one template, per-purpose emphasis)
```
---
name · description (the routing signal — crisp) · tools (least-privilege) · [model]
---
## Role            — what it is + its ⊥/ring position + the hard boundary stated ONCE
## I/O             — projected inputs · output schema (conformant artifact only)
## Method          — the genuine how-to (this is where depth lives — KEEP IT)
## Verification    — agent-SPECIFIC must-NOTs only (assertions). Generic gate → 1-line pointer to completion-verification-policy.md
## References       — schema @-imports · sibling/up/downstream agents by bare name
```
Per-purpose emphasis (what each category's body weights):
- **COORDINATOR** — the loop + the dispatch table + projection discipline. NO per-agent method (it routes). State-contract over prose for gates.
- **INTERACTION** — the state-transition table (condition→action). One-question-per-turn / readiness logic.
- **PERCEPTION/REASONING** — the **Method is the point** (the literal-observe test, the derivation rules, the taxonomy). Verification = the discriminating must-NOTs.
- **TOOL/BROWSER** — the tool sequence + the ACI (selectors/STOP-on-block) + coverage-flag honesty.
- **GENERATION** — the creative method once; provider/format specifics belong in a referenced config, not inlined.

## Restructure rules (what a fix may and may not do)
1. **Keep genuine method depth.** Long because the judgment is substantive (copy/layout/perception/brief) = correct, not a defect.
2. **Verification = agent-specific must-NOTs only.** The generic "schema≠correct / false-positive=0" gate is owned by `completion-verification-policy.md` → a one-line pointer (done in audit Stage 1). Do not re-walk the Method as a checklist.
3. **No embedded sub-documents.** A provider/format spec re-stated inside an agent (e.g. ChatGPT/Gemini adapter conventions) → extract to its canonical home (`config/` or a reference doc) the agent points to.
4. **One checklist per agent.** Merge a `## SELF-CHECKLIST` + `## Verification checklist` overlap.
5. **Don't restate shared rules.** Boundaries owned in `axis-model.md` (cost-invariant, rings, observe⊥name) / `non-negotiable-rules.md` → state the agent's own slice once + point.
6. **Don't flag specialization or deploy self-sufficiency.** A per-agent variation of a shared default is a *specialization* (must appear once). The orchestrator's entry-routine duplicates CLAUDE.md by design (the shipped plugin doesn't load CLAUDE.md) — keep.

## How to measure "too long" (the reframe)
Not raw lines. A file is over-built only if it contains: a re-stated shared policy (rule 2/5), an embedded sub-doc (rule 3), a duplicate checklist (rule 4), the same boundary echoed across sections (rule 4 of distilled), or a deterministic step written as prose (distilled 5). Remove those; whatever depth remains is the agent's legitimate contract.
