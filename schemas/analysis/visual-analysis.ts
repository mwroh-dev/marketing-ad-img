// SINGLE SOURCE for visual-analysis (TypeBox). L2c visual semantics + register, derived from perception (text-only).
// Lean descriptions = fill-signal; method/ring-2 discipline lives in visual-analyst.md.
import { Type } from "@sinclair/typebox";

const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

const SceneClass = Type.Object(
  {
    setting: U(["studio_plain", "lifestyle_indoor", "lifestyle_outdoor", "surface_flatlay", "in_situ_use", "abstract_graphic", "other"]),
    product_state: Type.Optional(U(["standalone", "in_use", "held", "packaging_only", "none", "other"], { description: "DERIVED from perception subjects: product + human/human_part ⇒ in_use/held; product alone ⇒ standalone; carton ⇒ packaging_only; none" })),
    prop_density: U(["none", "minimal", "moderate", "busy"]),
  },
  opts,
);

const Palette = Type.Object({ temp: Type.Optional(U(["warm", "cool", "neutral", "mixed"])), saturation: Type.Optional(U(["muted", "moderate", "vivid"])) }, opts);

export const name = "visual-analysis";
export const schema = Type.Object(
  {
    image_ref: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    medium: U(["photo", "illustration", "render_3d", "flat_graphic", "composite", "other"], { description: "carried from perception.medium (the gate)" }),
    scene_class: SceneClass,
    palette: Type.Optional(Palette),
    register: U(["clean_minimal", "warm_friendly", "energetic_bold", "premium_refined", "raw_authentic", "playful", "clinical", "nostalgic", "other"], { description: "impression NAMED from perception's look facts; brand-free (what the ad reads as on its own terms, NOT fit-to-us)" }),
    register_basis: Type.Optional(Type.String({ description: "anti-hallucination trace: the specific perception look/scene facts the register stands on (e.g. 'soft_diffused + neutral palette + minimal props')" })),
    confidence: Type.Optional(U(["high", "medium", "low"], { description: "lowered on a look↔copy mismatch — the mismatch is intent-analyst's signal" })),
  },
  { ...opts, $id: "https://marketing-img/schemas/visual-analysis.schema.json", title: "VisualAnalysis", description: "visual semantics + register, derived from perception (text-only), ring 2 brand-free" },
);

// consumers (intent-analyst, pattern-synthesizer) read register/medium/scene/palette — NOT register_basis
// (producer-only anti-hallucination trace). Producer reads the full view.
export const projections: Record<string, Record<string, string[] | "*">> = {
  consumer: { medium: "*", scene_class: "*", palette: "*", register: "*", confidence: "*" },
};
