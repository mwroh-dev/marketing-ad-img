# analysis — runbook

The goal is to turn the **KEPT ad images** of a run (the human-reviewed, screened corpus) into a per-persona
**ad-pattern** the generation pipeline can learn from — decomposed on the axes defined in
`${CLAUDE_PLUGIN_ROOT}/knowledge/reference/axis-model.md` (copy ⊥ layout ⊥ visual ⊥ intent, plus
copy×layout binding). Analysis is the **tail of a collection run**: it begins once `run.json` stage reaches
`screened` and ends at `analyzed`. Prompt-only system; no provider calls. Domain is never pre-fixed — the
product/persona come only from the run's projected state (`non-negotiable-rules.md`).

**Progress reporting:** report `[analysis · step k/9]` at each stage of the dispatch chain below (the stage table is the canonical enumeration); the stage advances `screened → analyzed` once step 9 completes.

## The cost invariant (do not violate)
**Vision tokens are spent ONCE**, in step 1 (`perception-extractor`). Steps 3–4 are **text-only** — every analyst
reads the perception text artifact, never the image. Re-sending the image to any later agent is a defect. Code
steps (2, 5) touch no model. See `axis-model.md` → "The cost invariant".

## Dispatch chain

Stage table — input → output, with the vision/text/code type that enforces the cost invariant. `⊥` = parallel
independent lanes off the same perception artifact. The chain runs per KEPT image (steps 1–7), then per persona
(steps 8–9).

| # | Stage | Type | Input → Output | Notes |
|---|---|---|---|---|
| 1 | `perception-extractor` | vision ×1 | KEPT image → `perception.json` | the ONLY pixel pass — geometry+text+scene+look, observe-only, confidence + absence |
| 2 | `slice-stitch` + `bbox-bind` | code | perception → global-frame perception + `bindings.json` | deterministic: slice y0/y1 recombined (section bboxes offset) + `bound_pairs[]` text↔graphic overlap (axis 6) |
| 3 | `ad-type-classifier` | text | perception → `ad-type.json` | message_basis/execution_style/ad_type + `grounds_in` (ad-taxonomy.md: Puto&Wells 1984 / Belch&Belch / Kotler / Frazer 1983); brand-free. `getAdType(ad_type)` → the adapter (`requires`/`gates`) consumed by step 7 |
| 4 | `copy-analyst` ⊥ `layout-analyst` ⊥ `visual-analyst` | text (parallel) | perception → `copy-analysis.json` / `layout-analysis.json` / `visual-analysis.json` | text-meaning / geometry-meaning / visual-semantics+register NAMED — ⊥ lanes |
| 5 | `intent-analyst` | text | copy+layout+visual+bindings → `intent-analysis.json` | appeal / funnel_stage + binding MEANING (axes 5 & 6) |
| 6 | `strategy-projector` | text | the analyses → `strategy-projection.json` | benefit_vector × funnel_intent + first_cognition + customer_language + reusability — ring 2, the AD'S OWN product lens, projects intent, `grounds_in` ad-strategy-taxonomy.md |
| 7 | `ad-type-gate` | code | `getAdType(ad_type).requires` vs the analyses → `ad-type-gate.json` | deterministic. **Where the ad-type classification CHANGES behavior** — raises `gates` flags on an ad that doesn't deliver its type (e.g. informational ad with no claim) |
| 8 | `ad-pattern-rank` · `keyword-rank` · `market-position-aggregate` | code | per-ad analyses → `ad-pattern.json` · `keyword-model.json` · `market-position-matrix.json` | rankByFreq over enum axes; benefit×funnel 2-D matrix + crowded/whitespace — observed prevalence, NOT performance (Ries&Trout / Kim&Mauborgne) |
| 9 | `pattern-synthesizer` | text | the aggregate → `ad-pattern.json.synthesis` | narrative ON TOP — never recompute the aggregate |

## Required state the orchestrator confirms before running
```yaml
required_state:
  - run_id                      # a dated collection run
  - stage: screened             # analysis runs on KEPT-only, post-human-gate, post-screen
  - persona_id                  # one persona's corpus per aggregation
```

## Outputs — the global lineage store (persona-keyed, run-independent)
Each per-image artifact is persisted into the **global lineage store** via `shared/lineage/persist-artifact.mjs`
(`persistArtifact`), NOT a run-scoped folder — the artifact's identity is the ad (persona+image), the run is just
provenance (`key.run_id`). Each is wrapped in a lineage envelope carrying its `derived_from` chain + `pattern_tag`
(`{ad_type}:{benefit}×{funnel}`) + the `logic_version` stamp (see `knowledge/reference/provenance-lineage.md`):
```
.generate-ads-img/store/{persona_id}/{ad}/perception.json   # envelope{payload: perception, derived_from: []}
                                       .../ad-type.json       #   ← perception
                                       .../copy|layout|visual.json   # ← perception
                                       .../intent.json        #   ← copy+layout+visual
                                       .../strategy.json      #   ← ad-type+intent+visual+copy
                                       .../ad-type-gate.json  #   ← ad-type+strategy+visual+copy
.generate-ads-img/store/{persona_id}/index.json              # rollup: slot → pattern_tag + kinds + chain
```
`migrate-pilot.mjs` is the reference implementation of the persist step (the chain map). The persona-node
aggregates (`ad-pattern.json` / `keyword-model.json` / `market-position-matrix.json`) remain the durable
per-persona outputs the generation pipeline reads. **Done when** every KEPT image has its store envelopes
(shape PASS + logic PASS), the index lists them, and `run.json` stage = `analyzed`.

### Persistence is MECHANICAL — run the deterministic tail (do NOT hand-summarize in-context)
The analysts persist their per-image output to disk in the **per-kind layout** the pipeline already uses:
`runs/{run_id}/analysis/{kind_dir}/{kind_dir}-{N}.json` (N = ad index; perception → `ocr/`, ad-type → `type/`,
the rest match their kind). After the analysts finish, the persistence is **one deterministic command + one gate**
— the orchestrator does NOT hand-write the store (it does so inconsistently: raw payloads, partial envelopes,
missing provenance):
- **close-analysis** (the easy-correct path): `node ${CLAUDE_PLUGIN_ROOT}/shared/harness/close-analysis.mjs {run_id}`
  → reads the per-kind staging, persists the per-ad lineage store envelopes (`persistAnalysisRun`, chain map
  perception→ocr / ad-type→type, provenance-stamped) + the index rollup, and advances the ledger to `analyzed`.
  FAILS LOUDLY if the staging is empty (the store is never silently improvised).
- **validate-store** (the teeth): `node ${CLAUDE_PLUGIN_ROOT}/node_modules/.bin/tsx ${CLAUDE_PLUGIN_ROOT}/shared/harness/validate-store.ts {persona_id}`
  → every store envelope must conform to `artifact-envelope.schema.json` (complete + provenance-stamped). A raw or
  hand-written partial → `STORE FAIL` (exit 1); the persona must NOT enter generation until it passes. We can't
  force the orchestrator to run close-analysis, but an improvised store CANNOT proceed. On FAIL, re-run
  close-analysis (it needs the per-kind staging present).

`market-position-matrix` is a generation-time input, not persisted here. At generation time it is built FROM the
durable store (`build-market-position.mjs --from-store <persona>`), which throws if analysis was never persisted —
so the matrix (and thus generation) depends on the store, not on this run's scratch staging.

Launch the per-ad analysts in **small batches (≤3 parallel), not one large fan-out** — a big parallel
background-agent batch can leave the loop waiting after the agents have already finished; small batches keep
completion reliable.

## Verification (gate per `completion-verification-policy.md`)
Each producing step is verified at two layers: **shape** (`tsx ${CLAUDE_PLUGIN_ROOT}/shared/validators/validate-ad-analysis.ts --<flag> <path>`)
⊥ **logic** (the agent's `## Verification checklist`, applied per-item to the agent's ACTUAL output on real data).
**On-disk shapes:** each per-image artifact (perception/ad-type/copy/layout/visual/intent/strategy) is a single object;
`copy`/`layout` are ALSO collected into `{analyses:[…]}` envelopes for the per-persona aggregation. The validator's
`--copy`/`--layout` accept EITHER shape (single object or envelope); the other flags take a single object.
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
