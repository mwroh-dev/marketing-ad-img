<!-- GENERATED from creative-candidate.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// container for image-generation creative candidates (provider-neutral)
creative-candidate = {
  run_id: string  // non-empty
  candidate_count: int /*1..12*/
  candidates: {
    candidate_id: string  // matches /^candidate_[0-9]{3}$/
    angle: "product_usp"|"persona_response"|"compelling_claim"|"visual_hierarchy"
    primary_variable?: string
    format: "meta_square_1_1"|"meta_feed_4_5"|"meta_story_9_16"|"meta_landscape_1_91_1"
    provider_neutral_spec: {
      candidate_id: string  // matches /^candidate_[0-9]{3}$/
      format: "meta_square_1_1"|"meta_feed_4_5"|"meta_story_9_16"|"meta_landscape_1_91_1"
      canvas: {
        ratio: string
        width: int /*1..*/
        height: int /*1..*/
      }
      product: {
        asset_id: string
        placement: string
        scale: "small"|"medium"|"large"
      }
      copy: {
        language: string
        headline: string  // non-empty
        subcopy?: string
        cta: string  // non-empty
      }
      layout: {
        headline_position: string
        product_position: string
        cta_position: string
        text_density: "low"|"medium"|"high"
      }
      style: {
        brand_mood: string
        color_direction: string
        avoid?: string[]
      }
    }  // the provider-neutral spec the image-prompt-adapter specializes into ChatGPT/Gemini prompts
    evidence_refs?: string[]
    assumption_notes?: string[]
    risk_notes?: string[]
  }[]  // 1..12 items
}
```
