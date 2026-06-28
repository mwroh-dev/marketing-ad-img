<!-- GENERATED from brand.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// domain knowledge: a brand (has many products)
brand = {
  brand_id: string  // non-empty
  brand_name: string  // non-empty
  brand_goal: string
  target_market?: {
    scope?: "domestic"|"overseas"|"both"
    regions?: string[]  // country/locale codes, e.g. KR/US/JP
    languages?: string[]  // ad copy languages, e.g. ko/en
  }  // WHERE the seller sells — scopes ad/competitor/research queries to the right market+language
  positioning?: string
  tone?: string
  forbidden_claims?: string[]
  product_ids: string[]
  evidence_refs?: string[]
}
```
