// SINGLE SOURCE for interview-state (TypeBox). Criteria-driven interview loop state (not question-count based).
// Read/written by interview-controller. Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const SLOT_STATE = ["missing", "insufficient", "filled", "confirmed"];

export const name = "interview-state";
export const schema = Type.Object(
  {
    run_id: Type.String({ minLength: 1 }),
    mode: Type.String(),
    status: U(["in_progress", "ready", "cancelled", "stopped"]),
    slots: Type.Array(
      Type.Object(
        { name: Type.String(), state: U(SLOT_STATE), value: Type.Optional(Type.Unknown()), evidence_refs: Type.Optional(Type.Array(Type.String())), answer_refs: Type.Optional(Type.Array(Type.String())) },
        opts,
      ),
    ),
    active_blocker: Type.Optional(
      Type.Union([Type.Null(), Type.Object({ slot: Type.String(), type: U(["hard_block", "soft_block"]), question: Type.Optional(Type.String()) }, opts)]),
    ),
    history: Type.Optional(
      Type.Array(Type.Object({ answer_ref: Type.String(), slots_updated: Type.Array(Type.String()) }, opts)),
    ),
  },
  { ...opts, $id: "https://marketing-img/schemas/interview-state.schema.json", title: "Interview state", description: "criteria-driven interview loop state — tracks slot resolution until hard blockers clear" },
);
