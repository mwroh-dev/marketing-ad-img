// SINGLE SOURCE for slice-manifest (TypeBox). Collection slicer output — long image → section mapping —
// CODE-produced/consumed (slice-long-image, slice-stitch). Migrated for single-source consistency.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;

const Section = Type.Object({ file: Type.String(), y0: Type.Integer({ minimum: 0 }), y1: Type.Integer({ minimum: 0 }) }, opts);

export const name = "slice-manifest";
export const schema = Type.Object(
  {
    sliced: Type.Array(Type.Object({ source: Type.String(), sections: Type.Array(Section) }, opts)),
    passthrough: Type.Array(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/slice-manifest.schema.json", title: "SliceManifest", description: "collection slicer output — long image → section mapping with source provenance" },
);
