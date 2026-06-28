// SINGLE SOURCE for product-asset (TypeBox). Raw + cutout product image refs + cleanup status. Code/registry. Parity.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals) => Type.Union(vals.map((v) => Type.Literal(v)));
export const name = "product-asset";
export const schema = Type.Object(
  {
    asset_id: Type.String({ minLength: 1 }),
    product_id: Type.String({ minLength: 1 }),
    raw_image_path: Type.String(),
    cutout_path: Type.Optional(Type.String()),
    preview_path: Type.Optional(Type.String()),
    mask_path: Type.Optional(Type.String()),
    cutout_status: U(["missing", "pending", "passed", "failed"]),
    cleanup_report_ref: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/product-asset.schema.json", title: "Product asset", description: "raw + cutout product image refs + cleanup status (cutout may not exist yet)" },
);
