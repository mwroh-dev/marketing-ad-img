// SINGLE SOURCE for logic-change (TypeBox). Global audit record of a change to the SHARED logic (the diff IS the
// git commit; this adds human-provenance + staleness impact). CODE-produced (logic-change-log). Parity gate.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals) => Type.Union(vals.map((v) => Type.Literal(v)));
export const name = "logic-change";
export const schema = Type.Object(
  {
    change_id: Type.String({ minLength: 1 }),
    at: Type.String({ minLength: 1, description: "ISO timestamp" }),
    trigger: Type.Object(
      { persona_id: Type.String({ minLength: 1 }), slot: Type.Optional(Type.String()), image_ref: Type.Optional(Type.String()), pattern_tag: Type.Optional(Type.String()) },
      { ...opts, description: "the ad that EXPOSED the flaw (the symptom)" },
    ),
    finding: Type.String({ minLength: 1, description: "what the human judged wrong" }),
    qa_log: Type.Optional(
      Type.Array(Type.Object({ role: U(["user", "agent"]), text: Type.String() }, opts), { description: "STRUCTURED record the agent authored (not a raw transcript dump)" }),
    ),
    commit_sha: Type.String({ minLength: 1, description: "the git commit that IS the logic fix" }),
    scope: U(["pattern", "slot", "persona", "global"], { description: "the human's verdict scope" }),
    impact: Type.Object(
      { stale_count: Type.Integer({ minimum: 0 }), stale_refs: Type.Optional(Type.Array(Type.String())), pattern_tags: Type.Optional(Type.Array(Type.String())) },
      { ...opts, description: "what the change makes stale (flag only — re-run is the human's choice)" },
    ),
  },
  { ...opts, $id: "https://marketing-img/schemas/logic-change.schema.json", title: "LogicChange", description: "audit record of a shared-logic change — human provenance + staleness impact" },
);
