// SINGLE SOURCE for candidate-selection-log (TypeBox). Records why each candidate was generated —
// CODE-produced (finalize-candidates). Migrated for single-source consistency (no agent reads it).
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;

export const name = "candidate-selection-log";
export const schema = Type.Object(
  {
    run_id: Type.String({ minLength: 1 }),
    candidate_count: Type.Integer({ minimum: 1, maximum: 12 }),
    selection_strategy: Type.String(),
    candidates: Type.Array(
      Type.Object(
        {
          candidate_id: Type.String({ pattern: "^candidate_[0-9]{3}$" }),
          angle: Type.String(),
          primary_variable: Type.String(),
          product_id: Type.String(),
          persona_id: Type.String(),
          copy_strategy: Type.Optional(Type.String()),
          layout_strategy: Type.Optional(Type.String()),
          format: Type.String(),
          adapter: Type.Optional(Type.Array(Type.String())),
          reason: Type.String({ minLength: 1 }),
        },
        opts,
      ),
      { minItems: 1 },
    ),
  },
  { ...opts, $id: "https://marketing-img/schemas/candidate-selection-log.schema.json", title: "Candidate selection log", description: "records why each candidate was generated (joinable by candidate_id)" },
);
