<!-- GENERATED from consumer.ts by schemas/build.ts — do not edit by hand -->
```ts
consumer = {
  image_ref: string
  persona_id: string
  appeal: "price"|"quality_proof"|"social_proof"|"fear_avoidance"|"aspiration"|"convenience"|"novelty"|"authority"|"scarcity"|"other"  // the dominant persuasion mechanism the ad uses (brand-free)
  secondary_appeals?: ("price"|"quality_proof"|"social_proof"|"fear_avoidance"|"aspiration"|"convenience"|"novelty"|"authority"|"scarcity"|"other")[]
  funnel_stage: "awareness"|"consideration"|"conversion"|"retargeting"|"other"
  primary_objection_addressed?: string  // free-text: the buyer objection this ad most neutralizes (not aggregated)
  look_copy_tension?: string  // the STRATEGY a look↔copy mismatch encodes (never a re-labeled register)
  confidence?: "high"|"medium"|"low"
}
```
