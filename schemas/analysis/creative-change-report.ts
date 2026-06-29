// SINGLE SOURCE for creative-change-report (TypeBox). Final payload rendered to HTML.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const Claim = (kinds: string[]) => Type.Object({ claim_kind: U(kinds), summary: Type.String({ minLength: 1 }), evidence_refs: Type.Optional(Type.Array(Type.String())) }, opts);

export const name = "creative-change-report";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    snapshot_range: Type.Object({ from_snapshot_id: Type.String({ minLength: 1 }), to_snapshot_id: Type.String({ minLength: 1 }) }, opts),
    confirmed_changes: Type.Array(Claim(["observed", "computed"])),
    classified_interpretations: Type.Array(Claim(["classified", "interpreted"])),
    inferred_hypotheses: Type.Array(Claim(["inferred"])),
    coverage_flags: Type.Array(Type.String()),
    synthesis: Type.Optional(Type.String()),
    generated_at: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/creative-change-report.schema.json", title: "CreativeChangeReport", description: "final creative-change report payload before deterministic HTML rendering" },
);
