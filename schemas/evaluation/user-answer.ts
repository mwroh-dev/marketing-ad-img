// SINGLE SOURCE for user-answer (TypeBox). Every interview answer becomes one — raw text verbatim + normalized
// slot updates. Produced by the user-answer-tooling skill; consumed by request-evaluator + interview-controller.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

export const name = "user-answer";
export const schema = Type.Object(
  {
    answer_id: Type.String({ minLength: 1 }),
    run_id: Type.String({ minLength: 1 }),
    raw_answer: Type.String({ description: "preserved VERBATIM — never paraphrased" }),
    for_blocker: Type.Object({ slot: Type.String(), question: Type.Optional(Type.String()) }, opts),
    normalized_slot_updates: Type.Array(
      Type.Object(
        { slot: Type.String(), value: Type.Unknown({ description: "the structured value (any shape)" }), resulting_state: U(["missing", "insufficient", "filled", "confirmed"]), evidence_refs: Type.Optional(Type.Array(Type.String())) },
        opts,
      ),
      { minItems: 1, description: "one answer may update multiple slots" },
    ),
    notes: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/user-answer.schema.json", title: "User answer artifact", description: "an interview answer — raw text verbatim + derived normalized slot updates" },
);
