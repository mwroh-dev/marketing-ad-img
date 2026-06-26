// SINGLE SOURCE for ad-creative (TypeBox). Per-persona set of real ad creatives from a public ad library.
// Producer = ad-creative-refiner (+ collectors); feeds analysis. Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const oStr = () => Type.Optional(Type.String());
const oArr = (d?: string) => Type.Optional(Type.Array(Type.String(), d ? { description: d } : {}));

const Creative = Type.Object(
  {
    library_id: oStr(),
    image_url: oStr(),
    image_file: oStr(),
    ad_copy: oStr(),
    platforms: Type.Optional(Type.Array(Type.String())),
    keywords: oArr("every search keyword whose results surfaced this ad (preserved across the global dedup)"),
    started_at: oStr(),
    subtype: U(["single_image", "carousel", "video_thumb", "video"]),
    advertiser_id: oStr(),
    resolved_via: Type.Optional(U(["advertiser", "advertiser_loose", "text_fallback"])),
    matched_name: oStr(),
    match_quality: Type.Optional(U(["exact", "prefix", "loose"])),
    type: Type.Optional(U(["ad_creative", "catalog", "spec", "review", "lifestyle", "unknown"], { description: "the ad-creative-refiner's TYPE classification" })),
    confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    competitor_id: oStr(),
    video_url: oStr(),
    video_file: oStr(),
    video_duration: oStr(),
    follower_count: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    status: Type.Optional(U(["active", "inactive", "unknown"])),
    page_category: oStr(),
    page_id: oStr(),
    detail_captured: Type.Optional(Type.Boolean()),
    advertiser_name: oStr(),
  },
  opts,
);

export const name = "ad-creative";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    product_id: oStr(),
    advertiser: oStr(),
    source: U(["meta_ad_library", "google_ads_transparency", "tiktok_creative_center", "own_detail_cut"]),
    search: Type.Object({ mode: U(["advertiser", "keyword", "detail_cut"]), query: Type.String(), category: oStr(), country: oStr() }, opts),
    creatives: Type.Array(Creative),
    queries: Type.Optional(Type.Array(Type.Object({ mode: U(["advertiser", "keyword"]), query: Type.String() }, opts))),
    coverage_flags: oArr(),
    blocked: Type.Optional(Type.Boolean()),
    captured_at: oStr(),
  },
  { ...opts, $id: "https://marketing-img/schemas/ad-creative.schema.json", title: "AdCreativeSet", description: "per-persona set of real ad creatives collected from a public ad library" },
);
