<!-- GENERATED from competitor.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// confirmed per-persona competitor set (domain knowledge)
competitor = {
  product_id: string  // non-empty
  persona_id: string  // non-empty
  relevance_criteria?: string
  competitors: {
    competitor_id: string  // non-empty
    name: string  // non-empty
    seller?: string
    url?: string
    source_surface?: "meta_ad_library"|"google_ads_transparency"
    rationale?: string
    evidence_refs?: string[]
    source_target_ref?: string
    status: "proposed"|"confirmed"|"rejected"  // confirmed only after explicit user sign-off (HARD GATE)
  }[]
  confirmed_at?: string
  rejected_note?: string
}
```
