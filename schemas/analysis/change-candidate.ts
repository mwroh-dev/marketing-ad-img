// SINGLE SOURCE for change-candidate (TypeBox). CODE-computed change candidates; not final interpretation.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

export const name = "change-candidate";
export const schema = Type.Object(
  {
    from_snapshot_id: Type.String({ minLength: 1 }),
    to_snapshot_id: Type.String({ minLength: 1 }),
    candidates: Type.Array(
      Type.Object(
        {
          candidate_id: Type.String({ minLength: 1 }),
          candidate_type: U(["inventory_change", "appeal_shift", "funnel_shift", "benefit_shift", "visual_register_shift", "layout_shift", "copy_role_shift", "audience_read_shift"]),
          claim_kind: U(["computed"]),
          input_claim_kinds: Type.Array(U(["observed", "classified"])),
          axis: Type.String({ minLength: 1 }),
          from: Type.Optional(Type.Any()),
          to: Type.Optional(Type.Any()),
          support_count: Type.Integer({ minimum: 0 }),
          share_delta: Type.Number(),
          strength: U(["weak", "medium", "strong"]),
          evidence_refs: Type.Array(Type.String()),
          coverage_flags: Type.Array(Type.String()),
        },
        opts,
      ),
    ),
    coverage_flags: Type.Array(Type.String()),
    generated_at: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/change-candidate.schema.json", title: "ChangeCandidateSet", description: "deterministic creative-change candidates, before agent interpretation" },
);
