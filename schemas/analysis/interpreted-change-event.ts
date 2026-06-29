// SINGLE SOURCE for interpreted-change-event (TypeBox). Agent-authored interpretation over deterministic candidates.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

export const name = "interpreted-change-event";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    events: Type.Array(
      Type.Object(
        {
          event_id: Type.String({ minLength: 1 }),
          based_on_candidate_ids: Type.Array(Type.String({ minLength: 1 })),
          event_type: Type.String({ minLength: 1 }),
          claim_kind: U(["interpreted", "inferred"]),
          summary: Type.String({ minLength: 1 }),
          evidence_refs: Type.Array(Type.String({ minLength: 1 })),
          confidence: U(["high", "medium", "low"]),
          forbidden_claims_checked: Type.Array(Type.String()),
        },
        opts,
      ),
    ),
    coverage_flags: Type.Array(Type.String()),
    generated_at: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/interpreted-change-event.schema.json", title: "InterpretedChangeEventSet", description: "agent-authored creative-change events over deterministic candidates" },
);
