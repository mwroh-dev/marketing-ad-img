// SINGLE SOURCE for ad-type-gate (TypeBox). Deterministic per-ad quality gate output — CODE-produced
// (shared/collect/ad-type-gate), no agent reads it as a contract. Migrated for single-source consistency.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;

export const name = "ad-type-gate";
export const schema = Type.Object(
  {
    image_ref: Type.String({ minLength: 1 }),
    persona_id: Type.Optional(Type.String()),
    ad_type: Type.String(),
    requires_checked: Type.Array(Type.String()),
    gates_raised: Type.Array(Type.String({ description: "the adapter `gates` flags raised by unmet `requires`" })),
  },
  { ...opts, $id: "https://marketing-img/schemas/ad-type-gate.schema.json", title: "AdTypeGate", description: "deterministic per-ad gate: routed adapter requires vs the analyses → gates_raised (no LLM)" },
);
