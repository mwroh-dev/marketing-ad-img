// SINGLE SOURCE for brand-research (TypeBox). One brand-researcher angle's findings — public-source evidence +
// data-derived category/persona CHOICES. Producer = brand-researcher. Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const refs1 = (d?: string) => Type.Array(Type.String(), { minItems: 1, ...(d ? { description: d } : {}) });

export const name = "brand-research";
export const schema = Type.Object(
  {
    brand_id: Type.String({ minLength: 1 }),
    angle: U(["page", "reviews", "positioning"], { description: "which research lens this artifact covers" }),
    sources_consulted: Type.Array(
      Type.Object({ ref: Type.String({ minLength: 1, description: "URL or search query actually used" }), method: U(["curl", "webfetch", "websearch", "cdp"]), reached: Type.Optional(Type.Boolean({ description: "false if blocked/unreachable" })) }, opts),
      { description: "every public source actually fetched/searched (honest)" },
    ),
    evidence: Type.Array(
      Type.Object({ observation: Type.String({ minLength: 1 }), source_ref: Type.String({ minLength: 1, description: "which sources_consulted[].ref this came from" }) }, opts),
      { description: "concrete observations — facts, not interpretation; each candidate traces here" },
    ),
    category_candidates: Type.Optional(Type.Array(Type.Object({ category: Type.String({ minLength: 1 }), evidence_refs: refs1() }, opts))),
    persona_candidates: Type.Optional(
      Type.Array(Type.Object({ label: Type.String({ minLength: 1 }), who: Type.String({ minLength: 1, description: "who this buyer is, in plain terms" }), pains: Type.Optional(Type.Array(Type.String())), desires: Type.Optional(Type.Array(Type.String())), evidence_refs: refs1("review/page observations grounding this persona — no fabrication") }, opts), { description: "data-derived persona options for the interview to present as CHOICES" }),
    ),
    positioning_signals: Type.Optional(Type.Array(Type.String())),
    forbidden_claim_risks: Type.Optional(Type.Array(Type.String(), { description: "claims observed that may be over-claims to guard downstream" })),
    coverage_flags: Type.Optional(Type.Array(Type.String(), { description: "what could NOT be reached/found — honest gaps" })),
  },
  { ...opts, $id: "https://marketing-img/schemas/brand-research.schema.json", title: "BrandResearchFindings", description: "one brand-researcher angle — public-source evidence + data-derived candidates" },
);
