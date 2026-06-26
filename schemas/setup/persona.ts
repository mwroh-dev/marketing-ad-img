// SINGLE SOURCE for persona (TypeBox). Domain knowledge: a product persona (from user answers + evidence).
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const oArr = () => Type.Optional(Type.Array(Type.String()));
export const name = "persona";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    product_id: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1 }),
    pains: oArr(),
    desires: oArr(),
    objections: oArr(),
    language_cues: oArr(),
    evidence_refs: oArr(),
  },
  { ...opts, $id: "https://marketing-img/schemas/persona.schema.json", title: "Persona", description: "domain knowledge: a product persona (pains/desires/objections/language_cues)" },
);
