// SINGLE SOURCE for competitor (TypeBox). Confirmed per-persona competitor set. Producer = competitor-curator.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const SURFACE = ["meta_ad_library", "google_ads_transparency"];

export const name = "competitor";
export const schema = Type.Object(
  {
    product_id: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    relevance_criteria: Type.Optional(Type.String()),
    competitors: Type.Array(
      Type.Object(
        {
          competitor_id: Type.String({ minLength: 1 }),
          name: Type.String({ minLength: 1 }),
          seller: Type.Optional(Type.String()),
          url: Type.Optional(Type.String()),
          source_surface: Type.Optional(U(SURFACE)),
          rationale: Type.Optional(Type.String()),
          evidence_refs: Type.Optional(Type.Array(Type.String())),
          source_target_ref: Type.Optional(Type.String()),
          status: U(["proposed", "confirmed", "rejected"], { description: "confirmed only after explicit user sign-off (HARD GATE)" }),
        },
        opts,
      ),
    ),
    confirmed_at: Type.Optional(Type.String()),
    rejected_note: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/competitor.schema.json", title: "CompetitorSet", description: "confirmed per-persona competitor set (domain knowledge)" },
);
