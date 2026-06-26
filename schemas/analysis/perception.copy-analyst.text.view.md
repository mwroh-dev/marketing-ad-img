<!-- GENERATED from copy-analyst.text.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
copy-analyst.text = {
  image_ref: string  // non-empty
  persona_id: string  // non-empty
  competitor_id?: string
  text_elements: {
    id?: string  // stable handle (t1,t2…) so downstream can reference it
    content: string  // verbatim characters; source language preserved; typos NOT fixed
    text_confidence?: number /*0..1*/  // per-element read confidence; low = blurry/overlapping/occluded
  }[]
  observation_confidence?: {
    text?: "high"|"medium"|"low"
  }  // per-axis high|medium|low; a low read travels marked
}
```
