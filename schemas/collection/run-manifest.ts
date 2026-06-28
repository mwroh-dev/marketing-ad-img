// SINGLE SOURCE for run-manifest (TypeBox). Per-run progress ledger (runs/{run_id}/run.json) — dated identity +
// monotonic stage. CODE-produced/consumed (run-manifest helpers, advance-stage). Parity gate.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const NullableInt0 = () => Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]);
const STAGE = ["collected", "human_reviewed", "screened", "analyzed"];

export const name = "run-manifest";
export const schema = Type.Object(
  {
    run_id: Type.String({ minLength: 1, description: "dated id, e.g. 2026-06-23-1430-meta-keyword" }),
    created_at: Type.String({ minLength: 1, description: "ISO-8601 run creation instant" }),
    source: Type.String({ minLength: 1, description: "collection source, e.g. meta_ad_library | google_ads_transparency" }),
    track: U(["category_keyword", "competitor"], { description: "category_keyword = ad-corpus track; competitor = advertiser track" }),
    persona_id: Type.String({ minLength: 1 }),
    product_id: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: "set when a keyword-plan carries it; null for a bare positional run" })),
    queries: Type.Array(
      Type.Object(
        {
          query: Type.String({ minLength: 1 }),
          mode: U(["keyword", "advertiser"]),
          axis: Type.Optional(Type.Union([...["needs", "use_case", "adjacency", "advertiser"].map((v) => Type.Literal(v)), Type.Null()], { description: "keyword-plan axis; advertiser for competitor queries; null for bare runs" })),
          results_count: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()], { description: "platform-reported result count (coverage signal); null if not captured" })),
        },
        opts,
      ),
      { description: "what was searched this run" },
    ),
    stage: U(STAGE, { description: "current pipeline stage — advances monotonically" }),
    counts: Type.Object({ collected: Type.Integer({ minimum: 0 }), kept_by_human: NullableInt0(), screened: NullableInt0(), analyzed: NullableInt0() }, opts),
    stage_history: Type.Optional(
      Type.Array(Type.Object({ stage: U(STAGE), at: Type.String({ minLength: 1 }) }, opts), { description: "append-only audit of stage transitions" }),
    ),
  },
  { ...opts, $id: "https://marketing-img/schemas/run-manifest.schema.json", title: "RunManifest", description: "per-run progress ledger — dated identity + monotonic stage (collected→human_reviewed→screened→analyzed)" },
);
