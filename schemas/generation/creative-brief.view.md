<!-- GENERATED from creative-brief.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// creative brief — core message, differentiation, 4 angles, forbidden-claim guards
creative-brief = {
  persona_id: string  // non-empty
  product_id: string  // non-empty
  core_message: string  // non-empty; the single sharpest line; traces to a product claim ∧ a persona pain/desire
  differentiation?: string
  key_messages?: object[]
  angles: {
    angle: "product_usp"|"persona_response"|"compelling_claim"|"visual_hierarchy"
    direction: string  // an actionable creative instruction, not a paraphrase of core_message
    evidence_refs?: string[]
  }[]  // 1.. items; the 4 enum angles, each a different lens on core_message (not 4 rewordings)
  forbidden_claims: string[]  // brand list verbatim ∪ derived-implicit; the hard guard the whole chain inherits
  evidence_refs?: string[]
  brand_tone?: string  // non-empty; the brand's voice (e.g. 'honest, energetic, not-luxury'); the adapter derives visual style from it, never premium-by-default
}
```
