<!-- GENERATED from perception.ts by schemas/build.ts — do not edit by hand -->
```ts
// literal observation of ONE ad image (axes 1-4), observe-only
perception = {
  image_ref: string
  persona_id: string
  competitor_id?: string
  medium: "photo"|"illustration"|"render_3d"|"flat_graphic"|"composite"|"other"  // axis-3 GATE; gates the photo-only fields (omit them unless photo)
  canvas: {
    aspect_ratio: string
    dominant_colors?: string[]  // hex
    background_desc?: string  // literal (e.g. 'solid cream'); never 'premium feel'
  }
  text_elements: {
    id?: string  // stable handle (t1,t2…) so downstream can reference it
    content: string  // verbatim characters; source language preserved; typos NOT fixed
    bbox: {
      x: number
      y: number
      w: number
      h: number
    }  // percent of canvas 0–100, top-left origin
    font_size_scale: "xs"|"s"|"m"|"l"|"xl"  // relative size within THIS image (xl=biggest), not absolute pt
    text_confidence?: number /*0..1*/  // per-element read confidence; low = blurry/overlapping/occluded
    color_hex?: string
    bold?: boolean
    shadow?: boolean
    align?: "left"|"center"|"right"
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
  scene: {
    subjects: {
      type: "human"|"human_part"|"animal_or_character"|"product"|"packaging"|"container_or_contents"|"environment"|"text_graphic"|"other"
      note?: string  // literal detail only (e.g. 'hand holding the box'); no impression / staged-real judgement
    }[]  // presence facts — everything depicted
    depicted: string  // one literal scene sentence; no impression, no real/fake judgement
    space?: "seamless_backdrop"|"real_room"|"outdoor"|"surface_top"|"none"|"other"  // photo-only background cue (disambiguates studio vs room); omit unless medium=photo
    shot_scale?: "extreme_closeup"|"closeup"|"medium"|"wide"|"other"  // photo-only; omit unless medium=photo
    angle?: "eye_level"|"high_angle"|"low_angle"|"top_down"|"other"  // photo-only; omit unless medium=photo
  }  // what is depicted, literally (no setting bucketing — that is downstream)
  look: {
    lighting?: "soft_diffused"|"hard_directional"|"natural_daylight"|"studio_even"|"dramatic_contrast"|"other"  // photo-only; omit when no light source
    brightness?: "dark"|"low_key"|"balanced"|"high_key"  // any medium
    finish?: "matte"|"glossy"|"textured"|"flat_graphic"|"other"  // dominant product surface only; omit if none
    look_desc?: string  // free-text literal light/surface fact if no enum fits; no impression/register
  }  // literal light/finish facts — NOT register/mood (that is visual-analyst)
  not_present?: ("no_price"|"no_human"|"no_logo"|"no_cta_text"|"no_background_scene"|"no_product_shot"|"other")[]  // salient absences — absence is signal
  observation_confidence?: {
    text?: "high"|"medium"|"low"
    geometry?: "high"|"medium"|"low"
    scene?: "high"|"medium"|"low"
    look?: "high"|"medium"|"low"
  }  // per-axis high|medium|low; a low read travels marked
  notes?: string[]
}
```
