<!-- GENERATED from keyword-model.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// per-persona keyword model: functional-slot groups with deterministic top-k ranking
keyword-model = {
  product_id: string  // non-empty
  persona_id: string  // non-empty
  corpus: {
    competitor_count: int /*0..*/
    source: string
  }
  weights: {
    tf: number
    df: number
    cue: number
  }
  groups: {
    slot: "product_category"|"feature"|"target"|"benefit"|"technique"|"other"
    keywords: {
      canonical: string  // non-empty
      variants?: string[]
      slot: "product_category"|"feature"|"target"|"benefit"|"technique"|"other"
      english_origin?: boolean
      tf: number
      df: number
      cue_match?: number
      score: number
    }[]
  }[]
  generated_at?: string
  confidence_note?: string
}
```
