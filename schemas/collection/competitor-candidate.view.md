<!-- GENERATED from competitor-candidate.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// discovery-scout broad candidate pool (search/list only, recall-max)
competitor-candidate = {
  product_id: string  // non-empty
  persona_id: string  // non-empty
  seeds?: string[]
  source_surfaces: ("meta_ad_library"|"google_ads_transparency")[]
  candidates: {
    name: string  // non-empty
    seller?: string
    url?: string
    snippet?: string
    source_surface: "meta_ad_library"|"google_ads_transparency"
    why_surfaced?: string
    persona_fit_score?: number  // optional curator hint — NEVER a discovery cutoff
    is_seed?: boolean
  }[]
  coverage_flags?: string[]
  blocked_surfaces?: string[]
  captured_at?: string
}
```
