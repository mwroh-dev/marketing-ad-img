// SINGLE SOURCE for critic-verdict (TypeBox). Generation critic output — per-candidate PASS/FAIL + overall.
// Producer = critic-verifier; consumed by CODE (validate-critic-verdict). Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;

export const name = "critic-verdict";
export const schema = Type.Object(
  {
    verdicts: Type.Array(
      Type.Object(
        {
          candidate_id: Type.String(),
          pass: Type.Boolean({ description: "true only when EVERY check cleared with nameable evidence (adversarial default false)" }),
          issues: Type.Optional(Type.Array(Type.String(), { description: "one concrete sentence per real defect — never fabricated" })),
          risk_flags: Type.Optional(Type.Array(Type.String(), { description: "categorical tags: forbidden_claim/overclaim/near_duplicate/brand_mismatch/altered_korean/empty_verification/boundary_violation" })),
        },
        opts,
      ),
      { minItems: 1 },
    ),
    overall_pass: Type.Boolean({ description: "AND of every candidate's pass" }),
  },
  { ...opts, $id: "https://marketing-img/schemas/critic-verdict.schema.json", title: "CriticVerdict", description: "per-candidate PASS/FAIL + overall verdict" },
);
