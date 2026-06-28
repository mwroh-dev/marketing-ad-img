// SINGLE SOURCE for brand (TypeBox). Domain knowledge: a brand (Brand 1 → Product N). Consumed by critic/brief
// (forbidden_claims/tone). Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals) => Type.Union(vals.map((v) => Type.Literal(v)));
export const name = "brand";
export const schema = Type.Object(
  {
    brand_id: Type.String({ minLength: 1 }),
    brand_name: Type.String({ minLength: 1 }),
    brand_goal: Type.String(),
    target_market: Type.Optional(
      Type.Object({ scope: Type.Optional(U(["domestic", "overseas", "both"])), regions: Type.Optional(Type.Array(Type.String(), { description: "country/locale codes, e.g. KR/US/JP" })), languages: Type.Optional(Type.Array(Type.String(), { description: "ad copy languages, e.g. ko/en" })) }, { ...opts, description: "WHERE the seller sells — scopes ad/competitor/research queries to the right market+language" }),
    ),
    positioning: Type.Optional(Type.String()),
    tone: Type.Optional(Type.String()),
    forbidden_claims: Type.Optional(Type.Array(Type.String())),
    product_ids: Type.Array(Type.String()),
    evidence_refs: Type.Optional(Type.Array(Type.String())),
  },
  { ...opts, $id: "https://marketing-img/schemas/brand.schema.json", title: "Brand", description: "domain knowledge: a brand (has many products)" },
);
