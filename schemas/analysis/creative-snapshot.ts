// SINGLE SOURCE for creative-snapshot (TypeBox). Static per-run ad state assembled from collected creatives
// plus durable analysis-store envelopes. CODE-produced; consumed by creative-change diffing.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const num = () => Type.Number();

const DistValue = Type.Object({ count: Type.Integer({ minimum: 0 }), share: num() }, opts);
const AxisDistribution = Type.Object(
  {
    values: Type.Optional(Type.Record(Type.String(), DistValue)),
    missing_count: Type.Optional(Type.Integer({ minimum: 0 })),
    low_confidence_count: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  opts,
);

const Observed = Type.Object(
  {
    text_hash: Type.Optional(Type.String()),
    image_asset_hash: Type.Optional(Type.String()),
    text_element_count: Type.Optional(Type.Integer({ minimum: 0 })),
    graphic_element_count: Type.Optional(Type.Integer({ minimum: 0 })),
    dominant_colors: Type.Optional(Type.Array(Type.String())),
    not_present: Type.Optional(Type.Array(Type.String())),
  },
  opts,
);

const Classified = Type.Object(
  {
    text_roles: Type.Optional(Type.Array(Type.String())),
    hook_types: Type.Optional(Type.Array(Type.String())),
    composition_type: Type.Optional(Type.String()),
    text_density: Type.Optional(Type.String()),
    visual_register: Type.Optional(Type.String()),
    scene_setting: Type.Optional(Type.String()),
    product_state: Type.Optional(Type.String()),
    appeal: Type.Optional(Type.String()),
    funnel_stage: Type.Optional(Type.String()),
    benefit_primary: Type.Optional(Type.String()),
    funnel_intent_stage: Type.Optional(Type.String()),
    ad_type: Type.Optional(Type.String()),
    execution_style: Type.Optional(Type.String()),
    audience_read: Type.Optional(Type.String()),
  },
  opts,
);

export const name = "creative-snapshot";
export const schema = Type.Object(
  {
    snapshot_id: Type.String({ minLength: 1 }),
    run_id: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    captured_at: Type.Optional(Type.String()),
    ads: Type.Array(
      Type.Object(
        {
          ad_key: Type.String({ minLength: 1 }),
          library_id: Type.Optional(Type.String()),
          image_ref: Type.String({ minLength: 1 }),
          advertiser_name: Type.Optional(Type.String()),
          status: Type.Optional(Type.String()),
          started_at: Type.Optional(Type.String()),
          identity_coverage: U(["trackable", "local_only"]),
          static_recipe: Type.Object(
            {
              observed: Observed,
              classified: Classified,
              confidence: Type.Optional(Type.Record(Type.String(), Type.String())),
              provenance_refs: Type.Array(Type.String()),
            },
            opts,
          ),
        },
        opts,
      ),
    ),
    aggregate: Type.Object({ axes: Type.Record(Type.String(), AxisDistribution) }, opts),
    coverage_flags: Type.Array(Type.String()),
    generated_at: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/creative-snapshot.schema.json", title: "CreativeSnapshot", description: "static per-run ad state for creative-change analysis" },
);
