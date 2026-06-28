<!-- GENERATED from product-asset.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// raw + cutout product image refs + cleanup status (cutout may not exist yet)
product-asset = {
  asset_id: string  // non-empty
  product_id: string  // non-empty
  raw_image_path: string
  cutout_path?: string
  preview_path?: string
  mask_path?: string
  cutout_status: "missing"|"pending"|"passed"|"failed"
  cleanup_report_ref?: string
}
```
