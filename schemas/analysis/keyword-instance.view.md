<!-- GENERATED from keyword-instance.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// ad-analyst output: extracted+normalized keyword instances (not ranked)
keyword-instance = {
  product_id: string  // non-empty
  persona_id: string  // non-empty
  source_competitors?: string[]
  instances: {
    canonical: string  // non-empty; the normalized surface form; loanword variants collapse to one canonical
    variants?: string[]
    slot: "product_category"|"feature"|"target"|"benefit"|"technique"|"other"  // functional role in the ad (judgment, not keyword-spotting)
    english_origin?: boolean
  }[]  // NO score/tf/df/rank — ranking is the deterministic script's job
}
```
