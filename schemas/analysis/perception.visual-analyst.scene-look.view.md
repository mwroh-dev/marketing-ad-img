<!-- GENERATED from visual-analyst.scene-look.ts by schemas/build.ts — do not edit by hand -->
```ts
visual-analyst.scene-look = {
  image_ref: string
  persona_id: string
  competitor_id?: string
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
  canvas: {
    dominant_colors?: string[]  // hex
  }
  graphic_elements: {
    id?: string
    kind: "product"|"lifestyle"|"icon"|"badge"|"chart"|"screenshot"|"illustration"|"other"  // shape/visual bucket of the element's form, never its role (screenshot=embedded UI capture)
  }[]
  not_present?: ("no_price"|"no_human"|"no_logo"|"no_cta_text"|"no_background_scene"|"no_product_shot"|"other")[]  // salient absences — absence is signal
  observation_confidence?: {
    scene?: "high"|"medium"|"low"
    look?: "high"|"medium"|"low"
  }  // per-axis high|medium|low; a low read travels marked
}
```
