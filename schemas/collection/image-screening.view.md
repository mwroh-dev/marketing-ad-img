<!-- GENERATED from image-screening.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// collection→analysis keep/drop gate; every collected image accounted for
image-screening = {
  run_id: string  // non-empty
  persona_id: string  // non-empty
  total: int /*0..*/  // must equal kept.length + dropped.length — no silent omission
  kept: string[]  // image_file paths that proceed to analysis
  dropped: {
    image_file: string  // non-empty
    reason: "user_removed"|"logo_only"|"ui_or_screenshot"|"unrelated"|"broken_or_empty"|"duplicate"|"no_ad_content"|"unreadable"
  }[]
}
```
