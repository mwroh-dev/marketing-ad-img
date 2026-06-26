// SINGLE SOURCE for copy-layout (TypeBox). Generation output — per-candidate Korean copy + layout plan.
// Producer = copy-layout-planner; consumed by CODE (finalize-candidates). Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const Nullable = (t: any) => Type.Union([t, Type.Null()]);

const Layout = Type.Object(
  {
    composition: Type.String({ description: "short frame description (e.g. 'product hero center, headline top-left')" }),
    text_density: U(["low", "medium", "high"], { description: "consistent with the angle (visual_hierarchy → low)" }),
    focal_point: Type.Optional(Type.String()),
    whitespace: Type.Optional(Type.String()),
    format: Type.Optional(Type.String()),
  },
  opts,
);

const Candidate = Type.Object(
  {
    angle: U(["product_usp", "persona_response", "compelling_claim", "visual_hierarchy"]),
    headline: Type.String({ minLength: 1, description: "final render-ready Korean, authored once (downstream preserves byte-for-byte)" }),
    subcopy: Type.Optional(Nullable(Type.String({ description: "one supporting line, or null when it earns nothing" }))),
    cta: Type.String({ minLength: 1, description: "short imperative Korean action phrase" }),
    layout: Layout,
  },
  opts,
);

export const name = "copy-layout";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    candidates: Type.Array(Candidate, { minItems: 1, description: "one per brief angle, the four distinct (different hook/headline/focal)" }),
    style: Type.Optional(
      Type.Object(
        { brand_tone: Type.Optional(Type.String({ minLength: 1, description: "the brand's voice carried from the brief; the adapter derives mood from it, never premium-by-default" })), avoid: Type.Optional(Type.Array(Type.String(), { description: "visual/claim avoids pushed into the adapter negative_prompt" })) },
        { ...opts, description: "brand voice carried from the brief — DRIVES the adapter's visual mood" },
      ),
    ),
  },
  { ...opts, $id: "https://marketing-img/schemas/copy-layout.schema.json", title: "CopyLayoutPlan", description: "per-candidate Korean copy + layout plan (copy authored once here)" },
);
