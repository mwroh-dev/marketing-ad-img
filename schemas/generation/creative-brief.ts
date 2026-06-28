// SINGLE SOURCE for creative-brief (TypeBox). Generation brief — core message, 4 angles, forbidden-claim guards.
// Producer = creative-brief-analyst; consumed by copy-layout-planner + critic-verifier. Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

const Angle = Type.Object(
  {
    angle: U(["product_usp", "persona_response", "compelling_claim", "visual_hierarchy"]),
    direction: Type.String({ description: "an actionable creative instruction, not a paraphrase of core_message" }),
    evidence_refs: Type.Optional(Type.Array(Type.String())),
  },
  opts,
);

export const name = "creative-brief";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    product_id: Type.String({ minLength: 1 }),
    core_message: Type.String({ minLength: 1, description: "the single sharpest line; traces to a product claim ∧ a persona pain/desire" }),
    differentiation: Type.Optional(Type.String()),
    key_messages: Type.Optional(Type.Array(Type.Object({}, { additionalProperties: true }))),
    angles: Type.Array(Angle, { minItems: 1, description: "the 4 enum angles, each a different lens on core_message (not 4 rewordings)" }),
    forbidden_claims: Type.Array(Type.String(), { description: "brand list verbatim ∪ derived-implicit; the hard guard the whole chain inherits" }),
    evidence_refs: Type.Optional(Type.Array(Type.String())),
    brand_tone: Type.Optional(Type.String({ minLength: 1, description: "the brand's voice (e.g. 'honest, energetic, not-luxury'); the adapter derives visual style from it, never premium-by-default" })),
  },
  { ...opts, $id: "https://marketing-img/schemas/creative-brief.schema.json", title: "CreativeBrief", description: "creative brief — core message, differentiation, 4 angles, forbidden-claim guards" },
);
