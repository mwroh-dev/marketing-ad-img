# analysis — runbook

The goal is to turn the **KEPT ad images** of a run (the human-reviewed, screened corpus) into a per-persona
**ad-pattern** the generation pipeline can learn from — decomposed on the axes defined in
`${CLAUDE_PLUGIN_ROOT}/knowledge/reference/axis-model.md` (copy ⊥ layout ⊥ visual ⊥ intent, plus
copy×layout binding). Analysis is the **tail of a collection run**: it begins once `run.json` stage reaches
`screened` and ends at `analyzed`. Prompt-only system; no provider calls. Domain is never pre-fixed — the
product/persona come only from the run's projected state (`non-negotiable-rules.md`).

**Steps (for progress reporting, ~7):** 1) `perception-extractor` (vision ×1: geometry+text+scene+look per KEPT image) → 2) `stitch` + `bind` (deterministic: global-frame recombine + text↔graphic overlap pairs) → 3) `ad-type-classifier` (grounded ad TYPE + route to adapter — text-only on perception, vision 0) → 4) `copy-analyst` ⊥ `layout-analyst` ⊥ `visual-analyst` (parallel: text-meaning / spatial-meaning / visual-semantics+register; the routed adapter's `emphasizes` tunes priority) → 5) `intent-analyst` (persuasion strategy + binding meaning) → 6) `ad-pattern-rank` (deterministic enum aggregation) + `keyword-rank` → 7) `pattern-synthesizer` (narrative on top of the aggregate). Report `[analysis · step k/7]` at each. Stage advances `screened → analyzed`.

## The cost invariant (do not violate)
**Vision tokens are spent ONCE**, in step 1 (`perception-extractor`). Steps 3–4 are **text-only** — every analyst
reads the perception text artifact, never the image. Re-sending the image to any later agent is a defect. Code
steps (2, 5) touch no model. See `axis-model.md` → "The cost invariant".

## Dispatch chain
```
per KEPT image (stage ≥ screened):
  perception-extractor  → perception.json        (geometry + text + scene + look, observe-only; confidence + absence)
        │  (vision ×1 — the ONLY pixel pass)
        ▼
  [code] slice-stitch   → global-frame perception (slice y0/y1 recombined; section bboxes offset)   ⎫ deterministic
  [code] bbox-bind      → bindings.json {bound_pairs[]: text_id↔graphic_id, overlap}                 ⎭ facts (axis 6)
        │
        ▼
  ad-type-classifier    → ad-type.json   (message_basis/execution_style/ad_type + grounds_in — TEXT-only, brand-free)
        │  getAdType(ad_type) → the defineAdType adapter's `emphasizes` tunes which axes the analysts prioritize.
        │  Grounded in knowledge/reference/ad-taxonomy.md (Puto&Wells 1984 / Belch&Belch / Kotler / Frazer 1983).
        ▼
        ├─ copy-analyst   → copy-analysis.json    (text role / hook / keywords — TEXT meaning only)      ⎫ parallel
        ├─ layout-analyst → layout-analysis.json  (composition / comfort — GEOMETRY meaning only)        ⎬ ⊥ lanes,
        └─ visual-analyst → visual-analysis.json  (scene taxonomy + register/mood NAMED — VISUAL only)   ⎭ text-only
        ▼
  intent-analyst        → intent-analysis.json    (appeal / funnel_stage + binding MEANING — axes 5 & 6)
        ▼
per persona:
  [code] ad-pattern-rank → ad-pattern.json        (rankByFreq over the enum axes; later: longevity-weighted)
  [code] keyword-rank    → keyword-model.json
        ▼
  pattern-synthesizer   → ad-pattern.json.synthesis  (narrative ON TOP — never recompute the aggregate)
```

## Required state the orchestrator confirms before running
```yaml
required_state:
  - run_id                      # a dated collection run
  - stage: screened             # analysis runs on KEPT-only, post-human-gate, post-screen
  - persona_id                  # one persona's corpus per aggregation
```

## Outputs (under `.generate-ads-img/runs/{run_id}/`)
```
analysis/{persona_id}/{image_ref}.perception.json      # step 1 (+ stitched global frame)
analysis/{persona_id}/{image_ref}.bindings.json        # step 2
analysis/{persona_id}/{image_ref}.copy.json            # step 3
analysis/{persona_id}/{image_ref}.layout.json          # step 3
analysis/{persona_id}/{image_ref}.visual.json          # step 3
analysis/{persona_id}/{image_ref}.intent.json          # step 4
→ ad-pattern.json / keyword-model.json on the PERSONA NODE   (stage=analyzed)
```
(Per-image artifact paths are the canonical home the prior pipeline lacked; only `ad-pattern.json` +
`keyword-model.json` are the durable persona-node outputs that downstream generation reads.)

## Verification (gate per `completion-verification-policy.md`)
Each producing step is verified at two layers: **shape** (`tsx ${CLAUDE_PLUGIN_ROOT}/shared/validators/validate-ad-analysis.ts --<flag> <path>`)
⊥ **logic** (the agent's `## Verification checklist`, applied per-item to the agent's ACTUAL output on real data).
Code steps (`slice-stitch`, `bbox-bind`, `ad-pattern-rank`) are gated by their co-located `*.test.mjs`
(`node --test`). **Done when:** every KEPT image has its six per-image artifacts (shape PASS + logic PASS),
the persona `ad-pattern.json` validates and carries the new enum aggregates + synthesis, and `run.json`
stage = `analyzed`.

## Boundaries
- `perception-extractor` observes; it never NAMES impressions (register/mood naming is `visual-analyst`). The
  observe ⊥ name line is `axis-model.md`'s mechanical test.
- `copy-analyst` does not stitch across sections — the **code** (`slice-stitch`) recombines; the agent analyzes
  what it is given.
- Aggregation enums are locked before the corpus runs; new vocabulary additions are pilot-then-lock, never
  mid-corpus (would invalidate prior aggregates).
