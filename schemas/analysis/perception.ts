// SINGLE SOURCE for the perception contract (TypeBox). Emits perception.schema.json (validator) +
// perception.view.md + per-consumer projection views via schemas/build.ts.
// Descriptions are LEAN (what an agent needs to FILL a field) — design rationale lives in
// knowledge/reference/axis-model.md. Validation parity with the prior hand-written schema is gated in build/test.
import { Type } from "@sinclair/typebox";

const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

const Bbox = Type.Object({ x: Type.Number(), y: Type.Number(), w: Type.Number(), h: Type.Number() }, { ...opts, description: "percent of canvas 0–100, top-left origin" });

const TextElement = Type.Object(
  {
    id: Type.Optional(Type.String({ description: "stable handle (t1,t2…) so downstream can reference it" })),
    content: Type.String({ description: "verbatim characters; source language preserved; typos NOT fixed" }),
    bbox: Bbox,
    font_size_scale: U(["xs", "s", "m", "l", "xl"], { description: "relative size within THIS image (xl=biggest), not absolute pt" }),
    text_confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: "per-element read confidence; low = blurry/overlapping/occluded" })),
    color_hex: Type.Optional(Type.String()),
    bold: Type.Optional(Type.Boolean()),
    shadow: Type.Optional(Type.Boolean()),
    align: Type.Optional(U(["left", "center", "right"])),
    line_breaks: Type.Optional(Type.Number({ description: "as-laid-out wrap count (3-line block = 2)" })),
  },
  opts,
);

const GraphicElement = Type.Object(
  {
    id: Type.Optional(Type.String()),
    kind: U(["product", "lifestyle", "icon", "badge", "chart", "screenshot", "illustration", "other"], { description: "shape/visual bucket of the element's form, never its role (screenshot=embedded UI capture)" }),
    bbox: Bbox,
    border: Type.Optional(U(["none", "line", "rounded", "shadow", "frame"])),
    placement: Type.Optional(Type.String()),
  },
  opts,
);

const Subject = Type.Object(
  {
    type: U(["human", "human_part", "animal_or_character", "product", "packaging", "container_or_contents", "environment", "text_graphic", "other"]),
    note: Type.Optional(Type.String({ description: "literal detail only (e.g. 'hand holding the box'); no impression / staged-real judgement" })),
  },
  opts,
);

const Scene = Type.Object(
  {
    subjects: Type.Array(Subject, { description: "presence facts — everything depicted" }),
    depicted: Type.String({ description: "one literal scene sentence; no impression, no real/fake judgement" }),
    space: Type.Optional(U(["seamless_backdrop", "real_room", "outdoor", "surface_top", "none", "other"], { description: "photo-only background cue (disambiguates studio vs room); omit unless medium=photo" })),
    shot_scale: Type.Optional(U(["extreme_closeup", "closeup", "medium", "wide", "other"], { description: "photo-only; omit unless medium=photo" })),
    angle: Type.Optional(U(["eye_level", "high_angle", "low_angle", "top_down", "other"], { description: "photo-only; omit unless medium=photo" })),
  },
  { ...opts, description: "what is depicted, literally (no setting bucketing — that is downstream)" },
);

const Look = Type.Object(
  {
    lighting: Type.Optional(U(["soft_diffused", "hard_directional", "natural_daylight", "studio_even", "dramatic_contrast", "other"], { description: "photo-only; omit when no light source" })),
    brightness: Type.Optional(U(["dark", "low_key", "balanced", "high_key"], { description: "any medium" })),
    finish: Type.Optional(U(["matte", "glossy", "textured", "flat_graphic", "other"], { description: "dominant product surface only; omit if none" })),
    look_desc: Type.Optional(Type.String({ description: "free-text literal light/surface fact if no enum fits; no impression/register" })),
  },
  { ...opts, description: "literal light/finish facts — NOT register/mood (that is visual-analyst)" },
);

const Canvas = Type.Object(
  {
    aspect_ratio: Type.String(),
    dominant_colors: Type.Optional(Type.Array(Type.String(), { description: "hex" })),
    background_desc: Type.Optional(Type.String({ description: "literal (e.g. 'solid cream'); never 'premium feel'" })),
  },
  opts,
);

const Conf = U(["high", "medium", "low"]);

export const name = "perception";
export const schema = Type.Object(
  {
    image_ref: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    competitor_id: Type.Optional(Type.String()),
    medium: U(["photo", "illustration", "render_3d", "flat_graphic", "composite", "other"], { description: "axis-3 GATE; gates the photo-only fields (omit them unless photo)" }),
    canvas: Canvas,
    text_elements: Type.Array(TextElement),
    graphic_elements: Type.Array(GraphicElement),
    scene: Scene,
    look: Look,
    not_present: Type.Optional(Type.Array(U(["no_price", "no_human", "no_logo", "no_cta_text", "no_background_scene", "no_product_shot", "other"]), { description: "salient absences — absence is signal" })),
    observation_confidence: Type.Optional(Type.Object({ text: Type.Optional(Conf), geometry: Type.Optional(Conf), scene: Type.Optional(Conf), look: Type.Optional(Conf) }, { ...opts, description: "per-axis high|medium|low; a low read travels marked" })),
    notes: Type.Optional(Type.Array(Type.String())),
  },
  { ...opts, $id: "https://marketing-img/schemas/perception.schema.json", title: "Perception", description: "literal observation of ONE ad image (axes 1-4), observe-only" },
);

// per-consumer axis projections (field-level ⊥ split — validated by the eval pilot, Round 3)
export const projections: Record<string, Record<string, string[] | "*">> = {
  "copy-analyst.text": { text_elements: ["id", "content", "text_confidence"], observation_confidence: ["text"] },
  "layout-analyst.geometry": { text_elements: ["id", "bbox", "font_size_scale", "align", "bold", "shadow", "line_breaks"], graphic_elements: "*", canvas: "*", medium: "*", observation_confidence: ["geometry"] },
  "visual-analyst.scene-look": { medium: "*", scene: "*", look: "*", canvas: ["dominant_colors"], graphic_elements: ["id", "kind"], not_present: "*", observation_confidence: ["scene", "look"] },
  "ad-type-classifier.text-scene-look": { text_elements: ["id", "content", "text_confidence"], medium: "*", scene: "*", look: "*", graphic_elements: ["id", "kind"], canvas: "*", not_present: "*", observation_confidence: ["text", "scene", "look"] },
};
