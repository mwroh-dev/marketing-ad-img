// SINGLE SOURCE for bindings (TypeBox). Axis-6 FACT half — deterministic text↔graphic spatial bindings
// (bbox-bind, CODE). Consumed by intent-analyst (reads the MEANING). Lean descriptions = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;

export const name = "bindings";
export const schema = Type.Object(
  {
    image_ref: Type.String({ minLength: 1 }),
    persona_id: Type.Optional(Type.String()),
    bound_pairs: Type.Array(
      Type.Object(
        { text_id: Type.String({ minLength: 1 }), graphic_id: Type.String({ minLength: 1 }), overlap: Type.Number({ minimum: 0, maximum: 1, description: "fraction of the text box area inside the graphic" }) },
        opts,
      ),
      { description: "a text element sits on a graphic element (geometry fact; the MEANING is intent-analyst's)" },
    ),
  },
  { ...opts, $id: "https://marketing-img/schemas/bindings.schema.json", title: "Bindings", description: "deterministic text↔graphic spatial bindings (axis-6 fact, no LLM)" },
);
