<!-- GENERATED from ad-type-classifier.text-scene-look.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
ad-type-classifier.text-scene-look = {
  image_ref: string  // non-empty
  persona_id: string  // non-empty
  competitor_id?: string
  text_elements: {
    id?: string  // stable handle (t1,t2…) so downstream can reference it
    content: string  // verbatim characters; source language preserved; typos NOT fixed
    text_confidence?: number /*0..1*/  // per-element read confidence; low = blurry/overlapping/occluded
  }[]
  medium: "photo"|"illustration"|"render_3d"|"flat_graphic"|"composite"|"other"  // axis-3 GATE; gates the photo-only fields (omit them unless photo)
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
  graphic_elements: {
    id?: string
    kind: "product"|"lifestyle"|"icon"|"badge"|"chart"|"screenshot"|"illustration"|"other"  // shape/visual bucket of the element's form, never its role (screenshot=embedded UI capture)
  }[]
  canvas: {
    aspect_ratio: string
    dominant_colors?: string[]  // hex
    background_desc?: string  // literal (e.g. 'solid cream'); never 'premium feel'
  }
  not_present?: ("no_price"|"no_human"|"no_logo"|"no_cta_text"|"no_background_scene"|"no_product_shot"|"other")[]  // salient absences — absence is signal
  observation_confidence?: {
    text?: "high"|"medium"|"low"
    scene?: "high"|"medium"|"low"
    look?: "high"|"medium"|"low"
  }  // per-axis high|medium|low; a low read travels marked
}
```
