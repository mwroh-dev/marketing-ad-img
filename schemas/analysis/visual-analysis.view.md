<!-- GENERATED from visual-analysis.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// visual semantics + register, derived from perception (text-only), ring 2 brand-free
visual-analysis = {
  image_ref: string  // non-empty
  persona_id: string  // non-empty
  medium: "photo"|"illustration"|"render_3d"|"flat_graphic"|"composite"|"other"  // carried from perception.medium (the gate)
  scene_class: {
    setting: "studio_plain"|"lifestyle_indoor"|"lifestyle_outdoor"|"surface_flatlay"|"in_situ_use"|"abstract_graphic"|"other"
    product_state?: "standalone"|"in_use"|"held"|"packaging_only"|"none"|"other"  // DERIVED from perception subjects: product + human/human_part ⇒ in_use/held; product alone ⇒ standalone; carton ⇒ packaging_only; none
    prop_density: "none"|"minimal"|"moderate"|"busy"
  }
  palette?: {
    temp?: "warm"|"cool"|"neutral"|"mixed"
    saturation?: "muted"|"moderate"|"vivid"
  }
  register: "clean_minimal"|"warm_friendly"|"energetic_bold"|"premium_refined"|"raw_authentic"|"playful"|"clinical"|"nostalgic"|"other"  // impression NAMED from perception's look facts; brand-free (what the ad reads as on its own terms, NOT fit-to-us)
  register_basis?: string  // anti-hallucination trace: the specific perception look/scene facts the register stands on (e.g. 'soft_diffused + neutral palette + minimal props')
  confidence?: "high"|"medium"|"low"  // lowered on a look↔copy mismatch — the mismatch is intent-analyst's signal
}
```
