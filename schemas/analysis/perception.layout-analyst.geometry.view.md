<!-- GENERATED from layout-analyst.geometry.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
layout-analyst.geometry = {
  image_ref: string  // non-empty
  persona_id: string  // non-empty
  competitor_id?: string
  text_elements: {
    id?: string  // stable handle (t1,t2…) so downstream can reference it
    bbox: {
      x: number
      y: number
      w: number
      h: number
    }  // percent of canvas 0–100, top-left origin
    font_size_scale: "xs"|"s"|"m"|"l"|"xl"  // relative size within THIS image (xl=biggest), not absolute pt
    align?: "left"|"center"|"right"
    bold?: boolean
    shadow?: boolean
    line_breaks?: number  // as-laid-out wrap count (3-line block = 2)
  }[]
  graphic_elements: {
    id?: string
    kind: "product"|"lifestyle"|"icon"|"badge"|"chart"|"screenshot"|"illustration"|"other"  // shape/visual bucket of the element's form, never its role (screenshot=embedded UI capture)
    bbox: {
      x: number
      y: number
      w: number
      h: number
    }  // percent of canvas 0–100, top-left origin
    border?: "none"|"line"|"rounded"|"shadow"|"frame"
    placement?: string
  }[]
  canvas: {
    aspect_ratio: string
    dominant_colors?: string[]  // hex
    background_desc?: string  // literal (e.g. 'solid cream'); never 'premium feel'
  }
  medium: "photo"|"illustration"|"render_3d"|"flat_graphic"|"composite"|"other"  // axis-3 GATE; gates the photo-only fields (omit them unless photo)
  observation_confidence?: {
    geometry?: "high"|"medium"|"low"
  }  // per-axis high|medium|low; a low read travels marked
}
```
