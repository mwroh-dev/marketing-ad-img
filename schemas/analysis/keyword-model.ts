// SINGLE SOURCE for keyword-model (TypeBox). Per-persona keyword model with deterministic top-k ranking —
// CODE-produced (keyword-rank). Migrated for single-source consistency.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const SLOT = ["product_category", "feature", "target", "benefit", "technique", "other"];
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

const Keyword = Type.Object(
  {
    canonical: Type.String({ minLength: 1 }),
    variants: Type.Optional(Type.Array(Type.String())),
    slot: U(SLOT),
    english_origin: Type.Optional(Type.Boolean()),
    tf: Type.Number(),
    df: Type.Number(),
    cue_match: Type.Optional(Type.Number()),
    score: Type.Number(),
  },
  opts,
);

export const name = "keyword-model";
export const schema = Type.Object(
  {
    product_id: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    corpus: Type.Object({ competitor_count: Type.Integer({ minimum: 0 }), source: Type.String() }, opts),
    weights: Type.Object({ tf: Type.Number(), df: Type.Number(), cue: Type.Number() }, opts),
    groups: Type.Array(Type.Object({ slot: U(SLOT), keywords: Type.Array(Keyword) }, opts)),
    generated_at: Type.Optional(Type.String()),
    confidence_note: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/keyword-model.schema.json", title: "KeywordModel", description: "per-persona keyword model: functional-slot groups with deterministic top-k ranking" },
);
