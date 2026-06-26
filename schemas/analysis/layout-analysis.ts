// SINGLE SOURCE for layout-analysis (TypeBox). L2a — layout structure + comfort from L1 geometry only.
// Lean descriptions = fill-signal; method/⊥-discipline lives in layout-analyst.md.
import { Type } from "@sinclair/typebox";

const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

const Comfort = Type.Object(
  {
    crowding: Type.Number({ description: "spacing density from geometry (min gaps, element count, edge proximity, overlaps); higher = more cramped — relative within this persona's ads, not an absolute threshold" }),
    awkward_placement: Type.Boolean({ description: "geometric: edge-cut / off-grid float / focal in a corner / misalignment" }),
    breathing_room: Type.Boolean({ description: "healthy whitespace + low crowding (must be consistent with crowding)" }),
    balance: Type.Optional(Type.String({ description: "weight distribution: symmetric / left-heavy / top-heavy / asymmetric" })),
  },
  opts,
);

export const name = "layout-analysis";
export const schema = Type.Object(
  {
    image_ref: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    composition_type: U(["product_only", "lifestyle", "comparison_table", "review_capture", "spec_list", "usage", "price_emphasis", "other"], { description: "from GEOMETRY (bbox grid/placement/size), never from what the text says" }),
    focal_point: Type.Optional(Type.String({ description: "the single highest visual-weight element (bbox area × size rank), named by geometry/position" })),
    visual_hierarchy: Type.Optional(Type.Array(Type.String(), { description: "elements ordered by descending geometric weight (size+position)" })),
    text_density: U(["low", "medium", "high"], { description: "summed text-bbox coverage + element count, not semantic heaviness" }),
    whitespace_ratio: Type.Optional(Type.Number({ description: "1 − (element-bbox union / canvas), in [0,1]" })),
    comfort: Comfort,
    grid_pattern: Type.Optional(Type.String()),
    confidence: Type.Optional(U(["high", "medium", "low"], { description: "read confidence — trust the layout read or escalate from the schema alone" })),
  },
  { ...opts, $id: "https://marketing-img/schemas/layout-analysis.schema.json", title: "LayoutAnalysis", description: "layout structure + comfort, derived from L1 geometry only" },
);

// per-consumer projections (drop grid_pattern + each consumer's irrelevant slice). Producer reads the full view.
export const projections: Record<string, Record<string, string[] | "*">> = {
  // intent-analyst reads how the composition "reads" — composition + focal/hierarchy + density + comfort/whitespace
  // (density/edge-cut modulate the read); only grid_pattern (vestigial free-string) is dropped
  "intent-analyst": { composition_type: "*", focal_point: "*", visual_hierarchy: "*", text_density: "*", whitespace_ratio: "*", comfort: "*", confidence: "*" },
  // pattern-synthesizer aggregates composition + density + comfort, not specific focal points
  "pattern-synthesizer": { composition_type: "*", text_density: "*", whitespace_ratio: "*", comfort: "*", confidence: "*" },
};

