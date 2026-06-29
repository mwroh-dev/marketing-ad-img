// SINGLE SOURCE for strategy-projection (TypeBox). Per-ad marketing-strategy projection (text-only, ring 2,
// own-product lens). Producer = strategy-projector; consumed by CODE (market-position-aggregate, validators).
// Lean descriptions = fill-signal; the taxonomy/projection rules live in strategy-projector.md + ad-strategy-taxonomy.md.
import { Type } from "@sinclair/typebox";

const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const score = () => Type.Integer({ minimum: 0, maximum: 2 });
const evidence = (sources: string[]) =>
  Type.Array(Type.Object({ source: U(sources), reason: Type.String({ minLength: 1 }) }, opts), { minItems: 1, description: "≥1 {source, reason} grounding this from the analyses" });

export const name = "strategy-projection";
export const schema = Type.Object(
  {
    image_ref: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    advertiser_context: Type.Optional(
      Type.Object({ advertiser_name: Type.Optional(Type.String()), page_id: Type.Optional(Type.String()), product_hint: Type.Optional(Type.String()) }, { ...opts, description: "the ad's OWN advertiser/product (so the read is 'company X's product', NOT judged against ours)" }),
    ),
    benefit_vector: Type.Object(
      {
        primary: U(["function", "cost", "trust", "symbol", "unclear"], { description: "purchase reason; `unclear` = insufficient evidence (coarsens intent.appeal)" }),
        secondary: Type.Optional(Type.Array(U(["function", "cost", "trust", "symbol"]))),
        evidence: evidence(["headline", "subcopy", "visual", "review", "badge", "price", "offer", "layout", "cta", "other"]),
      },
      opts,
    ),
    funnel_intent: Type.Object(
      {
        stage: U(["discovery", "comparison", "action", "retention", "unclear"], { description: "buyer-readiness; 1:1 projection of intent.funnel_stage" }),
        evidence: evidence(["headline", "cta", "offer", "layout", "proof", "visual", "other"]),
      },
      opts,
    ),
    first_cognition: Type.Object(
      {
        target_clarity: score(), situation_clarity: score(), problem_clarity: score(), product_category_clarity: score(),
        benefit_clarity: score(), reading_load: score(), jargon_penalty: score(), visual_legibility: score(),
        total_score: Type.Integer({ minimum: 0, maximum: 16, description: "MUST equal the sum of the eight 0-2 sub-scores" }),
        verdict: U(["strong", "acceptable", "weak", "unusable"]),
        blockers: Type.Optional(Type.Array(Type.String())),
      },
      { ...opts, description: "does it communicate in the first glance (ELM low-elaboration)" },
    ),
    customer_language: Type.Optional(
      Type.Object({ detected_phrases: Type.Optional(Type.Array(Type.String())), brand_language_phrases: Type.Optional(Type.Array(Type.String())), review_like_phrases: Type.Optional(Type.Array(Type.String())) }, { ...opts, description: "whose words the copy uses (VoC)" }),
    ),
    audience_read: Type.Optional(
      Type.Object(
        {
          primary: U(["price_sensitive", "proof_seeker", "social_validation_seeker", "convenience_seeker", "aspirational_buyer", "risk_avoidant", "unclear", "other"], { description: "the ad's inferred audience archetype read; NOT the configured persona_id" }),
          evidence: evidence(["copy", "visual", "offer", "problem", "layout", "other"]),
          confidence: U(["high", "medium", "low"]),
        },
        { ...opts, description: "classified audience-archetype read used only for creative-change distribution shifts; never a true persona-change claim" },
      ),
    ),
    generation_reusability: Type.Optional(
      Type.Object(
        { usable: Type.Boolean(), reason: Type.String({ minLength: 1 }), reusable_devices: Type.Optional(Type.Array(Type.String(), { description: "the ABSTRACT device, never competitor-specific content" })), avoid_copying: Type.Optional(Type.Array(Type.String(), { description: "the competitor-specific wording/asset that must NOT be copied" })) },
        opts,
      ),
    ),
    grounds_in: Type.String({ minLength: 1, description: "REQUIRED provenance — the ad-strategy-taxonomy.md source(s) this rests on" }),
    confidence: Type.Optional(U(["high", "medium", "low"])),
  },
  { ...opts, $id: "https://marketing-img/schemas/strategy-projection.schema.json", title: "StrategyProjection", description: "per-ad marketing-strategy projection (text-only, ring 2, own-product lens); projects intent, does not re-classify" },
);
