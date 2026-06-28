<!-- GENERATED from competitive-analyst.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
competitive-analyst = {
  persona_id: string  // non-empty
  product_id: string  // non-empty
  image_count: int /*0..*/
  copy_keywords_top_k?: {
    value: string
    freq: number
    score: number
  }[]
  hook_top_k?: {
    value: string
    freq: number
    score: number
  }[]
  appeal_top_k?: {
    value: string
    freq: number
    score: number
  }[]  // axis 5 — persuasion appeal distribution (the transferable strategy layer)
}
```
