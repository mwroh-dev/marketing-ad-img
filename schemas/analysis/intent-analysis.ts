// SINGLE SOURCE for intent-analysis (TypeBox). L2d — persuasion intent (axis 5) + binding meaning (axis 6).
// Lean descriptions = fill-signal; ring-2 brand-free discipline lives in intent-analyst.md.
import { Type } from "@sinclair/typebox";

const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const APPEAL = ["price", "quality_proof", "social_proof", "fear_avoidance", "aspiration", "convenience", "novelty", "authority", "scarcity", "other"];

const BindingReading = Type.Object(
  { text_id: Type.String(), graphic_id: Type.String(), meaning: Type.String({ minLength: 1, description: "what the placement DOES (e.g. price ON product = value anchored to product)" }) },
  opts,
);

export const name = "intent-analysis";
export const schema = Type.Object(
  {
    image_ref: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    appeal: U(APPEAL, { description: "the dominant persuasion mechanism the ad uses (brand-free)" }),
    secondary_appeals: Type.Optional(Type.Array(U(APPEAL))),
    funnel_stage: U(["awareness", "consideration", "conversion", "retargeting", "other"]),
    primary_objection_addressed: Type.Optional(Type.String({ description: "free-text: the buyer objection this ad most neutralizes (not aggregated)" })),
    binding_reading: Type.Optional(Type.Array(BindingReading, { description: "axis-6 MEANING per bound_pair; references bound_pairs by id" })),
    look_copy_tension: Type.Optional(Type.String({ description: "the STRATEGY a look↔copy mismatch encodes (never a re-labeled register)" })),
    evidence: Type.Optional(Type.String({ description: "anti-hallucination trace: which analysis facts the appeal was derived from" })),
    confidence: Type.Optional(U(["high", "medium", "low"])),
  },
  { ...opts, $id: "https://marketing-img/schemas/intent-analysis.schema.json", title: "IntentAnalysis", description: "persuasion intent (axis 5) + binding meaning (axis 6), ring 2 brand-free, text-only" },
);

// consumers (pattern-synthesizer aggregate, strategy-projector projection) read appeal/funnel + the qualitative
// why — NOT `evidence` (producer-only trace) nor the detailed `binding_reading` (axis-6 internals).
export const projections: Record<string, Record<string, string[] | "*">> = {
  consumer: { appeal: "*", secondary_appeals: "*", funnel_stage: "*", primary_objection_addressed: "*", look_copy_tension: "*", confidence: "*" },
};
