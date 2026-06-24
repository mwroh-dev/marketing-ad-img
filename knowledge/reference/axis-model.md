# Ad-image analysis — the axis model

System-design reference for how `marketing-img` decomposes an unstructured ad image into structured,
aggregatable facts. This is the canonical definition the analysis stage (perception → analysts →
aggregation) implements. It is **domain-neutral**: every enum value below is illustrative across
domains, never an assumed product/persona (per `non-negotiable-rules.md`).

## Why axes (the problem this solves)
Formalizing an image is a **lossy projection**: we keep only what lands on the axes we choose. Historically
we projected onto **two** axes — COPY (text meaning) and LAYOUT (geometry). Those are *extraction-convenient*
axes, not the axes where an ad's persuasion lives. Three things fell through:
1. **Visual meaning** — *what is depicted* and *what register it reads in* (subject, scene, mood) was never
   recorded, so the generation adapter had no visual signal and improvised a look from `brand_tone` alone.
2. **Intent** — *why the ad is built this way* (the persuasion strategy) is the **transferable** form; surface
   keywords don't transfer to a new product, strategies do. It was absent.
3. **Re-assembly** — copy and layout were split for clean extraction but never re-joined; an ad's force is in
   the *binding* (which line sits on which element), i.e. the interaction term, which was discarded.

## The 6 axes
| # | Axis | Question | Producer | Cost |
|---|---|---|---|---|
| 1 | Copy | what does it say | OCR (perception) → `copy-analyst` | OCR + text |
| 2 | Layout | where is it / how arranged | geometry (perception) → `layout-analyst` | text |
| 3 | Visual semantics | what is depicted (subject·scene·props) | **perception (observe)** → `visual-analyst` (classify) | **vision (observe only)** + text |
| 4 | Mood / register | how does it look/feel (color·light·finish) | **perception (observe)** → `visual-analyst` (name) | **vision (observe only)** + text |
| 5 | Intent / strategy | why built this way (persuasion) | `intent-analyst` | text |
| 6 | Copy×Layout binding | which text is bound to which element, meaning what | **code** (overlap) + `intent-analyst` (meaning) | code + text |

## The cost invariant (why the structure is shaped this way)
The expensive operation is **sending pixels to a multimodal model** (vision tokens), NOT the number of roles.
Therefore:
- **Vision is spent exactly once**, in the front **perception** pass, which observes axes 1·2·3·4.
- Every downstream analyst (`copy`, `layout`, `visual`, `intent`) reads the **perception text artifact only**
  and never re-sends the image. Adding roles adds **zero** vision tokens. (This preserves the existing
  Context Distribution Rule: layout/copy-analyst already receive the extraction, not the image.)
- **Code does facts** (bbox-overlap binding, slice-coordinate stitch, frequency/longevity aggregation);
  **LLM does meaning** (classification, register naming, strategy). They are never mixed in one pass — mixing
  extraction with interpretation makes the model "see what it expects" and corrupts the literal extraction.

## The observe ⊥ name boundary (the discriminating rule)
Perception may widen its **observation surface** to scene/look, but the **boundary is unchanged**: it records
literal facts, it never names impressions. The mechanical test:

> **Allowed (observation):** any fact a second observer would transcribe with the same words.
> **Forbidden (impression-naming):** any word that requires *knowing it is an ad* or *judging its effect.*

This is the exact line the existing `perception-extractor` already draws for `background_desc`:
`"solid cream"`, `"kitchen photo, soft blur"` are observations (**allowed**); `"premium feel"`,
`"trustworthy tone"` are impressions (**forbidden**). Phase 1 widens the surface (canvas → scene + look)
without moving this line. **Register/mood NAMING (`premium`, `honest`, `playful`) is the `visual-analyst`'s
job, downstream, on the text facts** — never perception's.

## Context rings — analysis is brand-free (context flows late)
Beyond observe ⊥ name, there is a deeper, phase-defining boundary: **how much brand context is admitted.**
The same ad can be read at three context-depths, each adding exactly one ring of context:

| Ring | Context admitted | Reads the ad as | Where in the system |
|---|---|---|---|
| ① object/literal | none (brand-, domain-, even ad-agnostic) | "a glass bottle, warm light, handwritten type" | **perception** (axis 1·2·3·4 observe) |
| ② ad-craft | only "this is an ad" (still brand-free) | "product close-up + handwritten → raw/authentic register, empathy hook, trust appeal" | **analysts** (copy·layout·visual·intent — classify the ad's own mechanics) |
| ③ brand-relative | our brand + persona + positioning | "for our premium persona this raw play is off; the category is crowded on raw, so we gap to clean-premium" | **creative-brief-analyst** (generation) — already exists |

**The law: context flows in LATE.** Admitting brand context early turns analysis into a mirror of our own
prejudice — a competitor ad read through "our brand glasses" only shows what we already want to see, and we
fail to understand the ad *on its own terms*. So:
- **The entire analysis pipeline is brand-free (rings ① and ②).** Competitor ads AND the seller's own
  detail-cuts are read by the *same* brand-agnostic yardstick — which is exactly what makes them comparable.
- **Brand enters once, at the brief** (ring ③, `creative-brief-analyst`), which fuses brand + persona + the
  brand-free `ad-pattern` into "what is the gap for us."
- Consequence for axis 5: **`intent-analyst` stays in ring ②** — it classifies *what persuasion mechanism the
  ad uses* (the `appeal`/`funnel_stage` enums), brand-free. Whether that mechanism is *right for us* is ring ③
  and belongs to the brief, never to analysis.
- Consequence for the taxonomy: rings ①·② are **enum-able** (object + ad-craft vocab don't depend on the
  brand). Ring ③ is **not** an analysis enum — it is the brief's free-form, brand-specific reasoning, and does
  not enter any `schemas/analysis/` field.

(Note: the brand still *scopes which ads get collected* upstream — but it never colors the per-ad *reading*.
Selection is brand-influenced; interpretation is brand-free.)

## Cross-cutting tags (ride on every axis)
- **confidence** — `high | medium | low`, per observed block. A perception value is never silently promoted
  to a hard fact downstream; the confidence travels with it.
- **absence** — what is *not* there is signal. Perception emits a controlled `not_present[]` list (e.g.
  `no_price`, `no_human`) — extraction schemes that only count presence miss "this category never shows price".
- **longevity weight** (implemented, opt-in) — at aggregation, a creative's run-duration (`running_days` from
  `started_at`) weights its contribution to the single-value axes, ranked by weight-share — frequency ≠ importance,
  a long-running ad carries more signal than the median. `ad-pattern-rank.longevityWeights` + the harness
  `--creatives --today` flags activate it. **Partial coverage by design:** only detail-captured creatives carry
  `started_at`; undated ones get the neutral weight 1 (never dropped, never zero-weighted), and the coverage ratio
  is surfaced in `confidence_note` — never silently treated as zero.

## Taxonomy — controlled vocabulary (DRAFT v0, pilot before lock)
New axes MUST be **enum** fields: the deterministic aggregator (`ad-pattern-rank.mjs`) ranks by frequency over
scalar enums, so free-text would not aggregate. Vocab is seeded from standard ad-photography terms (aligned with
the `visual-creative-toolkit` `visual-director`/`visual-style-guide` shot+style vocabulary) and normalized to a
canonical set (the `prompt-middleware` normalization pattern). **Every enum ends in `other` (codebase
convention).** These are a DRAFT — pilot on a handful of real KEPT images and lock before any agent runs the
corpus (`acquisition-must-not-outrun-validation-contract`).

The vocab splits by WHO assigns it — and this split is load-bearing for cost (see below):

**PERCEPTION emits (literal, needs pixels — `perception.schema.json`):**
- `medium` ∈ `photo | illustration | render_3d | flat_graphic | composite | other` — the GATE. Most-observable axis; a flat promo has no camera/light. **Pilot finding:** without this, every graphic/illustration ad forced `other` on shot/light fields and polluted aggregation.
- `scene.subjects[].type` ∈ `human | human_part | animal_or_character | product | packaging | container_or_contents | environment | text_graphic | other` (presence facts; `animal_or_character` added after the pilot's cat-illustration ad)
- `scene.depicted` — literal scene sentence (free-text, observe-only guardrail inline)
- `scene.shot_scale` / `scene.angle` — **photo-only** (omit unless `medium=photo`; omission is the signal, not `other`)
- `look.brightness` ∈ `dark | low_key | balanced | high_key` (any medium — the one look enum that mapped cleanly on all pilot images)
- `look.lighting` — **photo-only**; `look.finish` — **product-surface-only** (omit when absent)
- `graphic_elements[].kind` adds `screenshot | illustration` (recurring ad devices the pilot surfaced — fake-chat UI, illustrated mascot)
- `not_present[]` (absence) + `observation_confidence{text,geometry,scene,look}`

**VISUAL-ANALYST derives (buckets/impression, text-only on perception output — `visual-analysis.schema.json`):**
- `setting` ∈ `studio_plain | lifestyle_indoor | lifestyle_outdoor | surface_flatlay | in_situ_use | abstract_graphic | other`
- `product_state` ∈ `standalone | in_use | held | packaging_only | other` (DERIVED: product + human_part present ⇒ in_use/held)
- `palette_temp` ∈ `warm | cool | neutral | mixed` · `saturation` ∈ `muted | moderate | vivid` · `prop_density` ∈ `none | minimal | moderate | busy`
- `register` ∈ `clean_minimal | warm_friendly | energetic_bold | premium_refined | raw_authentic | playful | clinical | nostalgic | other` — the impression layer (ring ②), named from the `look` facts perception supplied

**`register` is LOOK-ONLY (decided after the two-worker pilot).** When the visual look and the copy/device disagree
— e.g. a clean-minimal photo wearing a fake-comment screenshot in raw-slang copy — `register` names what the
**look** reads as (here `clean_minimal`), and the **mismatch itself is recorded by `intent-analyst`** ("clean look
+ raw social-proof device") as a strategy signal. Layers are NOT fused into one "overall vibe": fusing loses which
layer drove the read, and the fused whole-ad reading is the brief's job (ring ③), not analysis. A look↔copy
mismatch lowers `visual-analysis.confidence` and is the intent-analyst's cue, never a re-labeled register.

**Why this split is the cost win:** every derived bucket above (setting, register, palette, product_state…) is computed by the text-only `visual-analyst` from perception's stored literal output. So if we later change the bucket vocab, we **re-run only the text analyst — never the vision pass**. The expensive observation is locked once; the cheap interpretation is re-runnable. This is what neutralizes the enum-lock-in risk: perception records facts (rarely change), `visual-analyst` assigns buckets (cheap to re-derive).

**Axis 5 — `intent` (`intent-analyst`, ring ② brand-free):**
- `appeal` ∈ `price | quality_proof | social_proof | fear_avoidance | aspiration | convenience | novelty | authority | scarcity | other`
- `funnel_stage` ∈ `awareness | consideration | conversion | retargeting | other`
- `primary_objection_addressed` — free-text rationale (NOT aggregated; the enum `appeal` is the aggregatable axis)

**Absence — `not_present[]` (perception):**
- ∈ `no_price | no_human | no_logo | no_cta_text | no_background_scene | no_product_shot | other`

## Pipeline (see the runbook)
`perception` (vision ×1, axes 1-4 observe) → `stitch` + `bind` (code, axis 6 facts) →
`copy-analyst` ⊥ `layout-analyst` ⊥ `visual-analyst` (axes 1·2·3·4 interpret) →
`intent-analyst` (axis 5 + axis 6 meaning) → `ad-pattern-rank` (enum aggregation) →
`pattern-synthesizer` (narrative). Canonical procedure: `knowledge/reference/modes/analysis.md`.
