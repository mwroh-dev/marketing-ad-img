<!-- GENERATED from run-manifest.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// per-run progress ledger — dated identity + monotonic stage (collected→human_reviewed→screened→analyzed)
run-manifest = {
  run_id: string  // non-empty; dated id, e.g. 2026-06-23-1430-meta-keyword
  created_at: string  // non-empty; ISO-8601 run creation instant
  source: string  // non-empty; collection source, e.g. meta_ad_library | google_ads_transparency
  track: "category_keyword"|"competitor"  // category_keyword = ad-corpus track; competitor = advertiser track
  persona_id: string  // non-empty
  product_id?: string|null  // set when a keyword-plan carries it; null for a bare positional run
  queries: {
    query: string  // non-empty
    mode: "keyword"|"advertiser"
    axis?: "needs"|"use_case"|"adjacency"|"advertiser"|null  // keyword-plan axis; advertiser for competitor queries; null for bare runs
    results_count?: int /*0..*/|null  // platform-reported result count (coverage signal); null if not captured
  }[]  // what was searched this run
  stage: "collected"|"human_reviewed"|"screened"|"analyzed"  // current pipeline stage — advances monotonically
  counts: {
    collected: int /*0..*/
    kept_by_human: int /*0..*/|null
    screened: int /*0..*/|null
    analyzed: int /*0..*/|null
  }
  stage_history?: {
    stage: "collected"|"human_reviewed"|"screened"|"analyzed"
    at: string  // non-empty
  }[]  // append-only audit of stage transitions
}
```
