<!-- GENERATED from persona.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// domain knowledge: a product persona (pains/desires/objections/language_cues)
persona = {
  persona_id: string  // non-empty
  product_id: string  // non-empty
  label: string  // non-empty
  pains?: string[]
  desires?: string[]
  objections?: string[]
  language_cues?: string[]
  evidence_refs?: string[]
}
```
