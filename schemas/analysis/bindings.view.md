<!-- GENERATED from bindings.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// deterministic text↔graphic spatial bindings (axis-6 fact, no LLM)
bindings = {
  image_ref: string  // non-empty
  persona_id?: string
  bound_pairs: {
    text_id: string  // non-empty
    graphic_id: string  // non-empty
    overlap: number /*0..1*/  // fraction of the text box area inside the graphic
  }[]  // a text element sits on a graphic element (geometry fact; the MEANING is intent-analyst's)
}
```
