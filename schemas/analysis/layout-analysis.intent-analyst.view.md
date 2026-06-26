<!-- GENERATED from intent-analyst.ts by schemas/build.ts — do not edit by hand -->
```ts
intent-analyst = {
  image_ref: string
  persona_id: string
  composition_type: "product_only"|"lifestyle"|"comparison_table"|"review_capture"|"spec_list"|"usage"|"price_emphasis"|"other"  // from GEOMETRY (bbox grid/placement/size), never from what the text says
  focal_point?: string  // the single highest visual-weight element (bbox area × size rank), named by geometry/position
  visual_hierarchy?: string[]  // elements ordered by descending geometric weight (size+position)
  text_density: "low"|"medium"|"high"  // summed text-bbox coverage + element count, not semantic heaviness
  whitespace_ratio?: number  // 1 − (element-bbox union / canvas), in [0,1]
  comfort: {
    crowding: number  // spacing density from geometry (min gaps, element count, edge proximity, overlaps); higher = more cramped — relative within this persona's ads, not an absolute threshold
    awkward_placement: boolean  // geometric: edge-cut / off-grid float / focal in a corner / misalignment
    breathing_room: boolean  // healthy whitespace + low crowding (must be consistent with crowding)
    balance?: string  // weight distribution: symmetric / left-heavy / top-heavy / asymmetric
  }
  confidence?: "high"|"medium"|"low"  // read confidence — trust the layout read or escalate from the schema alone
}
```
