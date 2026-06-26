// SINGLE SOURCE for competitive-trend (TypeBox). Per-persona competitive trend across dated snapshots —
// CODE-produced (competitive-trend), with `synthesis`/`confidence_note` filled ON TOP by competitive-analyst.
// Honesty: temporal fields are OMITTED (never null/0-filled) when unsupported. Lean descriptions = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const intMin0 = (description?: string) => Type.Integer({ minimum: 0, ...(description ? { description } : {}) });
const Nullable = (t: any) => Type.Union([t, Type.Null()]);

const Ad = Type.Object(
  {
    library_id: Type.String({ minLength: 1 }),
    advertiser_name: Type.Optional(Type.String()),
    started_at: Type.Optional(Type.String()),
    running_days: Type.Optional(intMin0("today − started_at; present only when started_at was captured")),
    platforms: Type.Optional(Type.Array(Type.String())),
    subtype: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    still_present: Type.Optional(Type.Boolean({ description: "appeared in the most recent dated snapshot; present only when seen in ≥1 dated snapshot" })),
    observed_span_days: Type.Optional(intMin0("last_seen − first_seen; present only when the ad spans ≥2 dated snapshots")),
  },
  opts,
);

export const name = "competitive-trend";
export const schema = Type.Object(
  {
    persona_id: Nullable(Type.String()),
    snapshot_count: intMin0("total snapshots aggregated (dated + undated)"),
    dated_snapshot_count: intMin0("subset with a parseable captured_at — change-over-time needs ≥2"),
    total_creatives: intMin0(),
    tracked_ads: intMin0("distinct ads tracked by library_id"),
    ads: Type.Array(Ad),
    longevity_top_k: Type.Array(
      Type.Object({ library_id: Type.String(), running_days: intMin0(), advertiser_name: Type.Optional(Type.String()), status: Type.Optional(Type.String()) }, opts),
      { description: "ads with started_at ranked by running_days desc (longevity = winner proxy); ads lacking started_at are excluded, not zero-ranked" },
    ),
    advertisers: Type.Array(
      Type.Object({ advertiser_name: Type.String({ minLength: 1 }), variation_count: intMin0(), platform_mix: Type.Optional(Type.Array(Type.String())) }, opts),
      { description: "per-advertiser creative variation (distinct ads) — available from a single snapshot" },
    ),
    new_since_last: Type.Optional(Type.Array(Type.String(), { description: "library_ids in the latest dated snapshot but not the previous; ABSENT (not []) when <2 dated snapshots" })),
    disappeared_since_last: Type.Optional(Type.Array(Type.String(), { description: "library_ids in the previous but gone from the latest; absent when <2 dated snapshots" })),
    cadence_new_ads_per_week: Type.Optional(Type.Number({ minimum: 0, description: "new distinct ads per week; absent when <2 dated snapshots or zero span" })),
    today: Type.Optional(Nullable(Type.String())),
    generated_at: Type.Optional(Type.String()),
    coverage_flags: Type.Array(Type.String()),
    synthesis: Type.Optional(Type.String({ description: "Korean interpretive narrative competitive-analyst adds ON TOP of the numbers (recomputes nothing)" })),
    confidence_note: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/competitive-trend.schema.json", title: "CompetitiveTrend", description: "per-persona competitive trend across dated snapshots (longevity + variation + change); temporal fields omitted when unsupported" },
);
