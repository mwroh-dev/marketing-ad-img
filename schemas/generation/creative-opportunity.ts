// SINGLE SOURCE for creative-opportunity (TypeBox). Generation ring-3 selection of strategic positions for OUR
// next ad. Producer = creative-opportunity-mapper; consumed by creative-brief-analyst. Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const strList = (description?: string) => Type.Array(Type.String(), { minItems: 1, ...(description ? { description } : {}) });

const BriefConstraints = Type.Object(
  {
    headline_style: Type.Optional(Type.String()),
    visual_style: Type.Optional(Type.String()),
    proof_device: Type.Optional(Type.String()),
    layout_device: Type.Optional(Type.String()),
    cta_direction: Type.Optional(Type.String()),
    must_include: Type.Optional(Type.Array(Type.String())),
    must_avoid: Type.Optional(Type.Array(Type.String())),
  },
  opts,
);

const Opportunity = Type.Object(
  {
    opportunity_id: Type.String({ minLength: 1 }),
    selected_position: Type.Object({ benefit: U(["function", "cost", "trust", "symbol"]), funnel: U(["discovery", "comparison", "action", "retention"]) }, opts),
    reason: strList("≥1 product/persona-fit reason this position was selected"),
    source_matrix_evidence: strList("≥1 matrix cell/device this rests on — no opportunity without matrix backing"),
    recommended_ad_type: Type.Optional(Type.String()),
    recommended_execution_style: Type.Optional(Type.Array(Type.String())),
    brief_constraints: Type.Optional(BriefConstraints),
    risk_notes: Type.Optional(Type.Array(Type.String())),
  },
  opts,
);

export const name = "creative-opportunity";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    selected_opportunities: Type.Array(Opportunity),
    rejected_positions: Type.Optional(Type.Array(Type.Object({ position: Type.String(), reason: Type.String() }, opts), { description: "why each candidate was NOT chosen" })),
    grounds_in: Type.Optional(Type.String()),
    confidence: Type.Optional(U(["high", "medium", "low"])),
  },
  { ...opts, $id: "https://marketing-img/schemas/creative-opportunity.schema.json", title: "CreativeOpportunity", description: "ring-3 selection of strategic positions + brief_constraints for OUR next ad (not a final prompt)" },
);
// Single consumer (creative-brief-analyst) reads most of the artifact (selected opportunities + grounding +
// rejected positions for context) — no projection; producer and consumer share the full view.
