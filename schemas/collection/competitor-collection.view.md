<!-- GENERATED from competitor-collection.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// creatives collected from a public ad-transparency library (credential-free)
competitor-collection = {
  from: string  // non-empty
  confirmed_targets: string[]
  source: string  // non-empty
  collected: int /*1..*/
  products: {
    idx: int
    query: string  // non-empty
    host: string  // non-empty
    title: string  // non-empty
    price?: string|null
    rating?: string|null
    reviewCount?: string|null
    image_urls: string[]
    image_files: string[]
    review_count_collected?: int
    reviews: string[]
  }[]  // 1.. items
  captured_at: string
}
```
