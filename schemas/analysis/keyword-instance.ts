// SINGLE SOURCE for keyword-instance (TypeBox). ad-analyst output: extracted+normalized keyword instances
// (NOT ranked — the deterministic keyword-rank ranks). Producer = ad-analyst; consumed by CODE. Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

export const name = "keyword-instance";
export const schema = Type.Object(
  {
    product_id: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    source_competitors: Type.Optional(Type.Array(Type.String())),
    instances: Type.Array(
      Type.Object(
        {
          canonical: Type.String({ minLength: 1, description: "the normalized surface form; loanword variants collapse to one canonical" }),
          variants: Type.Optional(Type.Array(Type.String())),
          slot: U(["product_category", "feature", "target", "benefit", "technique", "other"], { description: "functional role in the ad (judgment, not keyword-spotting)" }),
          english_origin: Type.Optional(Type.Boolean()),
        },
        opts,
      ),
      { description: "NO score/tf/df/rank — ranking is the deterministic script's job" },
    ),
  },
  { ...opts, $id: "https://marketing-img/schemas/keyword-instance.schema.json", title: "KeywordInstances", description: "ad-analyst output: extracted+normalized keyword instances (not ranked)" },
);
