// SINGLE SOURCE for competitor-candidate (TypeBox). discovery-scout output: broad per-persona candidate pool
// (search/list only — no deep-collected fields). Producer = discovery-scout; consumed by competitor-curator.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const SURFACE = ["meta_ad_library", "google_ads_transparency"];

export const name = "competitor-candidate";
export const schema = Type.Object(
  {
    product_id: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    seeds: Type.Optional(Type.Array(Type.String())),
    source_surfaces: Type.Array(U(SURFACE)),
    candidates: Type.Array(
      Type.Object(
        {
          name: Type.String({ minLength: 1 }),
          seller: Type.Optional(Type.String()),
          url: Type.Optional(Type.String()),
          snippet: Type.Optional(Type.String()),
          source_surface: U(SURFACE),
          why_surfaced: Type.Optional(Type.String()),
          persona_fit_score: Type.Optional(Type.Number({ description: "optional curator hint — NEVER a discovery cutoff" })),
          is_seed: Type.Optional(Type.Boolean()),
        },
        opts,
      ),
    ),
    coverage_flags: Type.Optional(Type.Array(Type.String())),
    blocked_surfaces: Type.Optional(Type.Array(Type.String())),
    captured_at: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/competitor-candidate.schema.json", title: "CompetitorCandidatePool", description: "discovery-scout broad candidate pool (search/list only, recall-max)" },
);
