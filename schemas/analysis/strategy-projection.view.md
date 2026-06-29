<!-- GENERATED from strategy-projection.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// per-ad marketing-strategy projection (text-only, ring 2, own-product lens); projects intent, does not re-classify
strategy-projection = {
  image_ref: string  // non-empty
  persona_id: string  // non-empty
  advertiser_context?: {
    advertiser_name?: string
    page_id?: string
    product_hint?: string
  }  // the ad's OWN advertiser/product (so the read is 'company X's product', NOT judged against ours)
  benefit_vector: {
    primary: "function"|"cost"|"trust"|"symbol"|"unclear"  // purchase reason; `unclear` = insufficient evidence (coarsens intent.appeal)
    secondary?: ("function"|"cost"|"trust"|"symbol")[]
    evidence: {
      source: "headline"|"subcopy"|"visual"|"review"|"badge"|"price"|"offer"|"layout"|"cta"|"other"
      reason: string  // non-empty
    }[]  // 1.. items; ≥1 {source, reason} grounding this from the analyses
  }
  funnel_intent: {
    stage: "discovery"|"comparison"|"action"|"retention"|"unclear"  // buyer-readiness; 1:1 projection of intent.funnel_stage
    evidence: {
      source: "headline"|"cta"|"offer"|"layout"|"proof"|"visual"|"other"
      reason: string  // non-empty
    }[]  // 1.. items; ≥1 {source, reason} grounding this from the analyses
  }
  first_cognition: {
    target_clarity: int /*0..2*/
    situation_clarity: int /*0..2*/
    problem_clarity: int /*0..2*/
    product_category_clarity: int /*0..2*/
    benefit_clarity: int /*0..2*/
    reading_load: int /*0..2*/
    jargon_penalty: int /*0..2*/
    visual_legibility: int /*0..2*/
    total_score: int /*0..16*/  // MUST equal the sum of the eight 0-2 sub-scores
    verdict: "strong"|"acceptable"|"weak"|"unusable"
    blockers?: string[]
  }  // does it communicate in the first glance (ELM low-elaboration)
  customer_language?: {
    detected_phrases?: string[]
    brand_language_phrases?: string[]
    review_like_phrases?: string[]
  }  // whose words the copy uses (VoC)
  audience_read?: {
    primary: "price_sensitive"|"proof_seeker"|"social_validation_seeker"|"convenience_seeker"|"aspirational_buyer"|"risk_avoidant"|"unclear"|"other"  // the ad's inferred audience archetype read; NOT the configured persona_id
    evidence: {
      source: "copy"|"visual"|"offer"|"problem"|"layout"|"other"
      reason: string  // non-empty
    }[]  // 1.. items; ≥1 {source, reason} grounding this from the analyses
    confidence: "high"|"medium"|"low"
  }  // classified audience-archetype read used only for creative-change distribution shifts; never a true persona-change claim
  generation_reusability?: {
    usable: boolean
    reason: string  // non-empty
    reusable_devices?: string[]  // the ABSTRACT device, never competitor-specific content
    avoid_copying?: string[]  // the competitor-specific wording/asset that must NOT be copied
  }
  grounds_in: string  // non-empty; REQUIRED provenance — the ad-strategy-taxonomy.md source(s) this rests on
  confidence?: "high"|"medium"|"low"
}
```
