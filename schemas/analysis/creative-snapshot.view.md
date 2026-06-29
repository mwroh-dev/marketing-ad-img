<!-- GENERATED from creative-snapshot.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// static per-run ad state for creative-change analysis
creative-snapshot = {
  snapshot_id: string  // non-empty
  run_id: string  // non-empty
  persona_id: string  // non-empty
  captured_at?: string
  ads: {
    ad_key: string  // non-empty
    library_id?: string
    image_ref: string  // non-empty
    advertiser_name?: string
    status?: string
    started_at?: string
    identity_coverage: "trackable"|"local_only"
    static_recipe: {
      observed: {
        text_hash?: string
        image_asset_hash?: string
        text_element_count?: int /*0..*/
        graphic_element_count?: int /*0..*/
        dominant_colors?: string[]
        not_present?: string[]
      }
      classified: {
        text_roles?: string[]
        hook_types?: string[]
        composition_type?: string
        text_density?: string
        visual_register?: string
        scene_setting?: string
        product_state?: string
        appeal?: string
        funnel_stage?: string
        benefit_primary?: string
        funnel_intent_stage?: string
        ad_type?: string
        execution_style?: string
        audience_read?: string
      }
      confidence?: {

      }
      provenance_refs: string[]
    }
  }[]
  aggregate: {
    axes: {

    }
  }
  coverage_flags: string[]
  generated_at?: string
}
```
