<!-- GENERATED from creative-opportunity.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// ring-3 selection of strategic positions + brief_constraints for OUR next ad (not a final prompt)
creative-opportunity = {
  persona_id: string  // non-empty
  selected_opportunities: {
    opportunity_id: string  // non-empty
    selected_position: {
      benefit: "function"|"cost"|"trust"|"symbol"
      funnel: "discovery"|"comparison"|"action"|"retention"
    }
    reason: string[]  // ≥1 item; ≥1 product/persona-fit reason this position was selected
    source_matrix_evidence: string[]  // ≥1 item; ≥1 matrix cell/device this rests on — no opportunity without matrix backing
    recommended_ad_type?: string
    recommended_execution_style?: string[]
    brief_constraints?: {
      headline_style?: string
      visual_style?: string
      proof_device?: string
      layout_device?: string
      cta_direction?: string
      must_include?: string[]
      must_avoid?: string[]
    }
    risk_notes?: string[]
  }[]
  rejected_positions?: {
    position: string
    reason: string
  }[]  // why each candidate was NOT chosen
  grounds_in?: string
  confidence?: "high"|"medium"|"low"
}
```
