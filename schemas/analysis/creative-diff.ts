// SINGLE SOURCE for creative-diff (TypeBox). CODE-computed edge between two creative snapshots.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

const AdRef = Type.Object(
  {
    ad_key: Type.String({ minLength: 1 }),
    library_id: Type.Optional(Type.String()),
    image_ref: Type.String({ minLength: 1 }),
  },
  opts,
);
const DistDelta = Type.Object(
  {
    from: Type.Number(),
    to: Type.Number(),
    delta: Type.Number(),
    support_count: Type.Integer({ minimum: 0 }),
  },
  opts,
);
const AxisDelta = Type.Object(
  {
    from_count: Type.Integer({ minimum: 0 }),
    to_count: Type.Integer({ minimum: 0 }),
    confidence_floor: Type.Optional(U(["high", "medium", "low"])),
    missing_axis: Type.Optional(Type.Boolean()),
    values: Type.Record(Type.String(), DistDelta),
  },
  opts,
);

export const name = "creative-diff";
export const schema = Type.Object(
  {
    from_snapshot_id: Type.String({ minLength: 1 }),
    to_snapshot_id: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    inventory_delta: Type.Object(
      {
        created: Type.Array(AdRef),
        deleted: Type.Array(AdRef),
        persisted: Type.Array(AdRef),
        untrackable: Type.Array(AdRef),
      },
      opts,
    ),
    update_delta: Type.Object(
      {
        same_library_id_changed_recipe: Type.Array(
          Type.Object(
            {
              library_id: Type.String({ minLength: 1 }),
              changed_axes: Type.Array(Type.String()),
              before: Type.Record(Type.String(), Type.Any()),
              after: Type.Record(Type.String(), Type.Any()),
              evidence_refs: Type.Array(Type.String()),
            },
            opts,
          ),
        ),
      },
      opts,
    ),
    distribution_delta: Type.Record(Type.String(), AxisDelta),
    coverage_flags: Type.Array(Type.String()),
    generated_at: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/creative-diff.schema.json", title: "CreativeDiff", description: "computed edge between two creative snapshots" },
);
