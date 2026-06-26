<!-- GENERATED from intent-analysis.ts by schemas/build.ts — do not edit by hand -->
```ts
// persuasion intent (axis 5) + binding meaning (axis 6), ring 2 brand-free, text-only
intent-analysis = {
  image_ref: string
  persona_id: string
  appeal: "price"|"quality_proof"|"social_proof"|"fear_avoidance"|"aspiration"|"convenience"|"novelty"|"authority"|"scarcity"|"other"  // the dominant persuasion mechanism the ad uses (brand-free)
  secondary_appeals?: ("price"|"quality_proof"|"social_proof"|"fear_avoidance"|"aspiration"|"convenience"|"novelty"|"authority"|"scarcity"|"other")[]
  funnel_stage: "awareness"|"consideration"|"conversion"|"retargeting"|"other"
  primary_objection_addressed?: string  // free-text: the buyer objection this ad most neutralizes (not aggregated)
  binding_reading?: {
    text_id: string
    graphic_id: string
    meaning: string  // what the placement DOES (e.g. price ON product = value anchored to product)
  }[]  // axis-6 MEANING per bound_pair; references bound_pairs by id
  look_copy_tension?: string  // the STRATEGY a look↔copy mismatch encodes (never a re-labeled register)
  evidence?: string  // anti-hallucination trace: which analysis facts the appeal was derived from
  confidence?: "high"|"medium"|"low"
}
```
