// SINGLE SOURCE for image-screening (TypeBox). Collection→analysis keep/drop gate. Two producers: the HUMAN
// keep/delete review + the deterministic screen-images.mjs pass (the agent producer is deprecated). Parity gate.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

export const name = "image-screening";
export const schema = Type.Object(
  {
    run_id: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    total: Type.Integer({ minimum: 0, description: "must equal kept.length + dropped.length — no silent omission" }),
    kept: Type.Array(Type.String({ minLength: 1 }), { description: "image_file paths that proceed to analysis" }),
    dropped: Type.Array(
      Type.Object({ image_file: Type.String({ minLength: 1 }), reason: U(["user_removed", "logo_only", "ui_or_screenshot", "unrelated", "broken_or_empty", "duplicate", "no_ad_content", "unreadable"]) }, opts),
    ),
  },
  { ...opts, $id: "https://marketing-img/schemas/image-screening.schema.json", title: "ImageScreening", description: "collection→analysis keep/drop gate; every collected image accounted for" },
);
