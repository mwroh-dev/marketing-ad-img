# image-generation — runbook

> **USER-FACING NAME = "image prompt generation" (image-PROMPT generation). NEVER call it "image generation".**
> This system is **prompt-only** — it never produces an image and never calls an image provider. The internal mode
> id is `image-generation` (kept for code/schema stability) but every word to the user must be "generate prompt candidates",
> not "generate images". Drifting to "image generation" on a repeat run is a known failure — guard against it.
> The deliverable is **image-prompt candidates the user feeds to ChatGPT/Gemini WITH their own product photo.**

When this mode is active, the orchestrator runs the creative pipeline that synthesizes brand, product, persona, the user request, collected signals, and global principles into image-prompt **candidates** (mode F·G). Prompt-only: no real image provider is called.

## The product photo is the FIXED hero (compose WITH it, do not regenerate)
The user attaches their OWN real product photo. The candidates must be prompts that **place that exact product
photo into a scene where it is used / shown** — keep the product unaltered, build the surrounding scene/copy/layout
around it. The pipeline is NOT "generate a product"; it is "make a prompt that works WITH the attached product
image as the hero." This orientation is carried by creative-brief-analyst → copy-layout-planner → image-prompt-adapter
(the adapter pins the product cutout as an `input_asset` and forbids regenerating/distorting it).

## Required state the orchestrator confirms before running

```yaml
required_slots:
  - brand_id
  - product_id
  - persona_id
  - creative_objective
  - formats
  - candidate_count
  - image_adapter_id
  - product_asset_id
  - user_request_summary
```

Supported `formats`: `meta_square_1_1`, `meta_feed_4_5`, `meta_story_9_16`, `meta_landscape_1_91_1`.

## Pipeline order (the agents the orchestrator dispatches, in sequence)

The orchestrator dispatches these agents in strict order, each consuming the prior stage's artifact:

```
creative-opportunity-mapper  →  creative-brief-analyst  →  copy-layout-planner  →  image-prompt-adapter  →  critic-verifier  →  finalize-candidates
   (opportunity, ring 3)              (brief)                 (copy ⊥ layout)        (prompt + asset)         (critique)          (finalize)
```

- **creative-opportunity-mapper** — the analysis→generation bridge (ring 3): consume the persona's `market-position-matrix` (benefit×funnel + crowded/whitespace) + OUR product selling-point/persona → select strategic positions → `creative-opportunity.json` (`brief_constraints`). Whitespace is an opportunity only with product/persona fit; cites matrix evidence. Where our product first enters.
- **creative-brief-analyst** — consume `creative-opportunity.json` (the precomputed gap + `brief_constraints`) + brand/product/persona/request → `creative-brief.json`. **Then normalize the shape:** `node ${CLAUDE_PLUGIN_ROOT}/shared/harness/normalize-artifact.mjs creative-brief <run_dir>/creative/creative-brief.json` — a CONSERVATIVE strip of only known meta annotations the model tends to add (e.g. `direction_repair_note`); it never touches `core_message`/`angles` content (a new substance field is left for the gate to surface, not silently dropped).
- **copy-layout-planner** — plan copy and layout from the brief → write **exactly** `creative/copy-layout.json` (the conformance gate + `finalize-candidates --copy` read this exact name; `copy-layout-plan.json` etc. are silently skipped).
- **image-prompt-adapter** — turn the plan into a provider-shaped image prompt, pulling the product cutout via the asset registry (`product_asset_id`) and the adapter via `image_adapter_id`.
- **critic-verifier** — critique candidates against brief + non-negotiable rules. **Then normalize the shape:** `node ${CLAUDE_PLUGIN_ROOT}/shared/harness/normalize-artifact.mjs critic-verdict <run_dir>/creative/critic-verdict.json` — a judgment artifact has a FIXED shape, so this schema-whitelists it: undoes the `candidate_verdicts`→`verdicts` rename and drops the model's process bookkeeping (`run_id`, `passing/failing_candidates`, `repair_log`). The verdict content (`pass`/`issues`/`risk_flags`) is preserved verbatim — only the envelope is conformed. The critic reasons freely; the shape is made deterministic after.
- **finalize-candidates** (`${CLAUDE_PLUGIN_ROOT}/shared/harness/finalize-candidates`) — select and emit the final candidate set + selection log.
- **conformance gate (code, before presenting)** — `node ${CLAUDE_PLUGIN_ROOT}/node_modules/.bin/tsx ${CLAUDE_PLUGIN_ROOT}/shared/harness/validate-gen-run.ts <run_dir>`. Validates EVERY artifact the run produced (opportunity · brief · copy-layout · market-position-matrix · critic-verdict · adapter outputs · candidates · selection-log) against its schema. A `GEN-RUN FAIL` (exit 1) means an agent or the orchestrator emitted a non-conformant artifact (extra field on a closed object, a missing required field, an improvised shape instead of the deterministic producer's). Do NOT present candidates on FAIL: repair the *named* offending artifact at its source — re-dispatch that one agent with the schema view, or run the deterministic producer (e.g. `market-position-aggregate.mjs` for the matrix) — then re-run the gate until it passes. The gate is the runtime enforcement of the schemas; conformance is not assumed from an agent's self-report.

## Candidate count

```yaml
default: 4
minimum: 1
maximum: 12
```

The orchestrator emits **4 candidates by default** (overridable by `candidate_count` within [1, 12]).

## Outputs

```txt
.generate-ads-img/runs/{run_id}/creative/creative-brief.json
.generate-ads-img/runs/{run_id}/creative/creative-candidates.json
.generate-ads-img/runs/{run_id}/creative/candidate-selection-log.json
.generate-ads-img/runs/{run_id}/generated-prompts/
```

## Execution rule (gate)

**Prompt-only — no real image-provider call in MVP.** The pipeline emits prompt artifacts only; the orchestrator never lets a stage call an actual image provider.
