<!-- GENERATED from copy-analyst.text.ts by schemas/build.ts — do not edit by hand -->
```ts
copy-analyst.text = {
  image_ref: string
  persona_id: string
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
