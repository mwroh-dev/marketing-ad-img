<!-- GENERATED from competitive-trend.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// per-persona competitive trend across dated snapshots (longevity + variation + change); temporal fields omitted when unsupported
competitive-trend = {
  persona_id: string|null
  snapshot_count: int /*0..*/  // total snapshots aggregated (dated + undated)
  dated_snapshot_count: int /*0..*/  // subset with a parseable captured_at — change-over-time needs ≥2
  total_creatives: int /*0..*/
  tracked_ads: int /*0..*/  // distinct ads tracked by library_id
  ads: {
    library_id: string  // non-empty
    advertiser_name?: string
    started_at?: string
    running_days?: int /*0..*/  // today − started_at; present only when started_at was captured
    platforms?: string[]
    subtype?: string
    status?: string
    still_present?: boolean  // appeared in the most recent dated snapshot; present only when seen in ≥1 dated snapshot
    observed_span_days?: int /*0..*/  // last_seen − first_seen; present only when the ad spans ≥2 dated snapshots
  }[]
  longevity_top_k: {
    library_id: string
    running_days: int /*0..*/
    advertiser_name?: string
    status?: string
  }[]  // ads with started_at ranked by running_days desc (longevity = winner proxy); ads lacking started_at are excluded, not zero-ranked
  advertisers: {
    advertiser_name: string  // non-empty
    variation_count: int /*0..*/
    platform_mix?: string[]
  }[]  // per-advertiser creative variation (distinct ads) — available from a single snapshot
  new_since_last?: string[]  // library_ids in the latest dated snapshot but not the previous; ABSENT (not []) when <2 dated snapshots
  disappeared_since_last?: string[]  // library_ids in the previous but gone from the latest; absent when <2 dated snapshots
  cadence_new_ads_per_week?: number /*0..*/  // new distinct ads per week; absent when <2 dated snapshots or zero span
  today?: string|null
  generated_at?: string
  coverage_flags: string[]
  synthesis?: string  // Korean interpretive narrative competitive-analyst adds ON TOP of the numbers (recomputes nothing)
  confidence_note?: string
}
```
