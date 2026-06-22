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
creative-brief-analyst  →  copy-layout-planner  →  image-prompt-adapter  →  critic-verifier  →  finalize-candidates
        (brief)               (copy ⊥ layout)        (prompt + asset)         (critique)          (finalize)
```

- **creative-brief-analyst** — fold brand/product/persona/request/signals into `creative-brief.json`.
- **copy-layout-planner** — plan copy and layout from the brief.
- **image-prompt-adapter** — turn the plan into a provider-shaped image prompt, pulling the product cutout via the asset registry (`product_asset_id`) and the adapter via `image_adapter_id`.
- **critic-verifier** — critique candidates against brief + non-negotiable rules.
- **finalize-candidates** (`${CLAUDE_PLUGIN_ROOT}/shared/harness/finalize-candidates`) — select and emit the final candidate set + selection log.

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
