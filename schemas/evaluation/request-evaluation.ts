// SINGLE SOURCE for request-evaluation (TypeBox). request-evaluator output — mode/slots/blockers/ready/next-target.
// Producer = request-evaluator; consumed by interview-controller + CODE. Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const SLOT_STATE = ["missing", "insufficient", "filled", "confirmed"];

export const name = "request-evaluation";
export const schema = Type.Object(
  {
    run_id: Type.String({ minLength: 1 }),
    raw_request: Type.Optional(Type.String()),
    detected_mode: U(["initial-setup", "data-collection", "competitive-report", "validate-recipe", "image-generation", "performance-learning", "unknown"]),
    mode_confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: "<0.6 (with a risk_flag) when the call is uncertain" })),
    required_slots: Type.Array(Type.String()),
    slot_states: Type.Array(Type.Object({ name: Type.String(), state: U(SLOT_STATE) }, opts)),
    blockers: Type.Array(
      Type.Object({ slot: Type.String(), type: U(["hard_block", "soft_block"]), priority: Type.Integer({ minimum: 1 }), reason: Type.Optional(Type.String()) }, opts),
    ),
    ready: Type.Boolean({ description: "true ⇔ zero hard_block remains (count, never assert)" }),
    next_interview_target: Type.Union(
      [Type.Null(), Type.Object({ slot: Type.String(), rationale: Type.Optional(Type.String()) }, opts)],
      { description: "null IFF ready; else the highest-priority HARD blocker" },
    ),
    risk_flags: Type.Optional(Type.Array(Type.String())),
  },
  { ...opts, $id: "https://marketing-img/schemas/request-evaluation.schema.json", title: "Request evaluation", description: "classifies mode, required slots, blockers, ready, and the next interview target" },
);
