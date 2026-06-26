<!-- GENERATED from copy-layout.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// per-candidate Korean copy + layout plan (copy authored once here)
copy-layout = {
  persona_id: string  // non-empty
  candidates: {
    angle: "product_usp"|"persona_response"|"compelling_claim"|"visual_hierarchy"
    headline: string  // non-empty; final render-ready Korean, authored once (downstream preserves byte-for-byte)
    subcopy?: string|null
    cta: string  // non-empty; short imperative Korean action phrase
    layout: {
      composition: string  // short frame description (e.g. 'product hero center, headline top-left')
      text_density: "low"|"medium"|"high"  // consistent with the angle (visual_hierarchy → low)
      focal_point?: string
      whitespace?: string
      format?: string
    }
  }[]  // ≥1 item; one per brief angle, the four distinct (different hook/headline/focal)
  style?: {
    brand_tone?: string  // non-empty; the brand's voice carried from the brief; the adapter derives mood from it, never premium-by-default
    avoid?: string[]  // visual/claim avoids pushed into the adapter negative_prompt
  }  // brand voice carried from the brief — DRIVES the adapter's visual mood
}
```
