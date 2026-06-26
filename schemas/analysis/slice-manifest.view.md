<!-- GENERATED from slice-manifest.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// collection slicer output — long image → section mapping with source provenance
slice-manifest = {
  sliced: {
    source: string
    sections: {
      file: string
      y0: int /*0..*/
      y1: int /*0..*/
    }[]
  }[]
  passthrough: string[]
}
```
