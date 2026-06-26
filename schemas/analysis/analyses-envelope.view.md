<!-- GENERATED from analyses-envelope.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// copy/layout output envelope — {persona_id, analyses[]}; each item validated separately
analyses-envelope = {
  persona_id: string  // non-empty
  analyses: {
    image_ref: string
    persona_id: string
  }[]  // ≥1 item
}
```
