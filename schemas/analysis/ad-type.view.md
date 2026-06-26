<!-- GENERATED from ad-type.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// the ad-type classification for ONE ad (text-only, ring 2), with grounds_in provenance
ad-type = {
  image_ref: string  // non-empty
  persona_id: string  // non-empty
  message_basis: "informational"|"transformational"|"hybrid"|"other"  // layer 1 — what carries the message (Puto & Wells 1984)
  execution_style: "straight_sell"|"scientific_evidence"|"demonstration"|"comparison"|"testimonial"|"slice_of_life"|"lifestyle"|"mood_image"|"fantasy"|"personality_symbol"|"dramatization"|"humor"|"animation"|"musical"|"other"  // layer 2 — observable execution style (Belch & Belch; Kotler & Armstrong)
  secondary_execution_styles?: ("straight_sell"|"scientific_evidence"|"demonstration"|"comparison"|"testimonial"|"slice_of_life"|"lifestyle"|"mood_image"|"fantasy"|"personality_symbol"|"dramatization"|"humor"|"animation"|"musical"|"other")[]
  ad_type: "informational"|"transformational"|"social_proof"|"default"  // the routed seed adapter (ad-taxonomy.md routing table)
  grounds_in: string  // non-empty; REQUIRED provenance — the ad-taxonomy.md citation(s) this rests on; a classification with no basis is a defect
  reason?: string  // which perception facts drove the call (anti-hallucination trace)
  confidence?: "high"|"medium"|"low"
}
```
