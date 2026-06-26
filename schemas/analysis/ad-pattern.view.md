<!-- GENERATED from ad-pattern.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// per-persona aggregated ad composition + strategy pattern (deterministic top-k + synthesis)
ad-pattern = {
  product_id: string  // non-empty
  persona_id: string  // non-empty
  image_count: int /*0..*/
  composition_top_k: {
    value: string
    freq: number
    score: number
  }[]
  text_role_distribution: {

  }  // role → share map
  hook_top_k?: {
    value: string
    freq: number
    score: number
  }[]
  copy_keywords_top_k?: {
    value: string
    freq: number
    score: number
  }[]
  medium_top_k?: {
    value: string
    freq: number
    score: number
  }[]  // axis 3 — rendering medium distribution (from visual analyses)
  setting_top_k?: {
    value: string
    freq: number
    score: number
  }[]  // axis 3 — scene setting distribution
  register_top_k?: {
    value: string
    freq: number
    score: number
  }[]  // axis 4 — named visual register/mood distribution
  appeal_top_k?: {
    value: string
    freq: number
    score: number
  }[]  // axis 5 — persuasion appeal distribution (the transferable strategy layer)
  funnel_stage_top_k?: {
    value: string
    freq: number
    score: number
  }[]  // axis 5 — funnel stage distribution
  comfort: {
    avg_crowding: number
    avg_whitespace: number
    awkward_rate: number
  }
  synthesis?: string  // interpretive narrative added by pattern-synthesizer ON TOP (recomputes nothing)
  generated_at?: string
  confidence_note?: string
}
```
