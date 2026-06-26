// SINGLE SOURCE for analyses-envelope (TypeBox). The {persona_id, analyses[]} wrapper for copy/layout outputs;
// each item is validated separately against its copy-analysis / layout-analysis schema (so the items are OPEN).
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;

export const name = "analyses-envelope";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    // items are intentionally OPEN (no additionalProperties:false) — validated against the per-analysis schema elsewhere
    analyses: Type.Array(Type.Object({ image_ref: Type.String(), persona_id: Type.String() }), { minItems: 1 }),
  },
  { ...opts, $id: "https://marketing-img/schemas/analyses-envelope.schema.json", title: "AnalysesEnvelope", description: "copy/layout output envelope — {persona_id, analyses[]}; each item validated separately" },
);
