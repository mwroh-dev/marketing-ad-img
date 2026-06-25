# Ad-type taxonomy — the grounded classification of advertisements

System-design reference for how `marketing-img` classifies an ad creative into a **type**, so the analysis stage
can route to a type-appropriate adapter (emphasize the axes that carry THIS kind of ad's message). It is
**domain-neutral**: every enum value is illustrative across product domains, never an assumed product/persona
(per `non-negotiable-rules.md`).

## Why type ads (the problem this solves)
Ads differ in **kind**, and the difference is *what carries the message*. A functional ad makes its case with
facts/claims/specs (text and structure carry it); an emotional ad makes its case with scene/mood/identity (the
image carries it). Analyzing both the same way under-reads each. So before the per-axis analysts run, we classify
the ad's type and let an adapter emphasize the axes that matter for that type.

## Provenance principle (this doc is the citable basis)
The types below are **NOT invented here.** Advertising scholarship has classified ad types for decades, and this
doc grounds every classifier value in that established literature with an explicit `(Author, Year)` citation. The
rule for the whole system: **a classification or an adapter must trace to a source in this doc.** When we later add
or change a type, this doc is the basis to argue from or against — the `ad-type-classifier` agent and every
`defineAdType` adapter carry a `grounds_in` field pointing back here. (This introduces an author/year citation
style; it keeps the repo's existing inline-source spirit, cf. `axis-model.md`'s `(aligned with …)` convention.)

## Layer 1 — message basis (the primary routing axis)
The cleanest, validated split of "what carries the message": **informational vs transformational**
*(Puto & Wells, 1984)*. It is a 2×2 (info × transformational), so a **hybrid** (both high) is a first-class value —
e.g. a clean product photo wearing a social-proof device.

| `message_basis` | definition | source | emphasize |
|---|---|---|---|
| `informational` | conveys objective product facts / logic / claims | Puto & Wells (1984) | copy(claims) · layout(structure) · binding |
| `transformational` | links the brand to subjective emotion / identity / sensory reward | Puto & Wells (1984) | visual(scene/register/medium) · intent(aspiration) |
| `hybrid` | both an objective claim layer AND an emotional/identity layer carry the message | Puto & Wells (1984) 2×2 | both — adapter `default` |
| `other` | none of the above fits | — | — |

(Appeal triad — rational / emotional / moral — *(Kotler; Belch & Belch)* — is the sibling lens; it is captured by
the `intent.appeal` axis, not re-encoded here.)

## Layer 2 — execution style (the concrete, observable ad type)
The granular, *directly observable in a static creative* type — the "expert categories" of advertising. Canonical
list from *Belch & Belch, Advertising and Promotion* and *Kotler & Armstrong, Principles of Marketing*. This is the
aggregatable type enum (its distribution = "this category is X% testimonial, Y% demonstration").

| `execution_style` | definition (1 line) | leans | source |
|---|---|---|---|
| `straight_sell` | factual presentation of the product/benefit, no drama | informational | Belch & Belch |
| `scientific_evidence` | survey/lab/technical evidence of superiority | informational | Belch & Belch; Kotler |
| `demonstration` | the product shown in use, illustrating performance | informational | Belch & Belch; Kotler |
| `comparison` | direct/implied contrast vs another brand or a before/after | informational | Belch & Belch |
| `testimonial` | a believable/likeable source (user, expert, celebrity) endorses it | hybrid | Belch & Belch; Kotler |
| `slice_of_life` | everyday people in an everyday situation using the product | transformational | Belch & Belch; Kotler |
| `lifestyle` | how the product fits a target lifestyle/identity | transformational | Kotler |
| `mood_image` | a mood/feeling/image is built around the product | transformational | Kotler |
| `fantasy` | a fantasy/imagery world created around the product | transformational | Kotler; Belch & Belch |
| `personality_symbol` | a character/mascot embodies the brand | transformational | Belch & Belch; Kotler |
| `dramatization` | a short dramatic story/problem-solution around the product | transformational | Belch & Belch |
| `humor` | humor is the central device | transformational | Belch & Belch |
| `animation` | drawn/animated execution | transformational | Belch & Belch |
| `musical` | music/jingle central (rare in static creative) | transformational | Belch & Belch; Kotler |
| `other` | an observable style outside this set | — | — |

## Layer 3 — creative strategy (strategic intent)
The strategic intent behind the message *(Frazer, 1983)*: `generic`, `preemptive`, `usp`, `brand_image`,
`positioning`, `resonance`, `affective`. This layer is **already carried by the `intent.appeal` axis**
(`intent-analyst`) — e.g. USP→`quality_proof`, resonance/affective→emotional appeals, positioning→comparison. It is
not a separate classifier output; it is recorded here so the appeal axis has a cited basis.

## Context (NOT a creative-level classifier)
**FCB Grid** *(Vaughn, 1980)* — think/feel × high/low involvement. **Excluded as a classifier axis** because
*involvement* is a property of the product/decision, not observable from one static creative. Useful as planning
context for the brief (ring ③), never as a per-image type. Recorded here so the exclusion is a documented, citable
decision, not an omission.

## Routing — `ad_type` (the seed adapters)
The classifier routes to one adapter. Seed set (accretes over time); each `defineAdType` adapter's `grounds_in`
cites the rows above.

| `ad_type` | routes when | grounds_in | adapter emphasizes |
|---|---|---|---|
| `informational` | message_basis=informational (demonstration/scientific/comparison/straight_sell) | Puto & Wells (1984) informational; Belch & Belch execution styles | copy(claims) · layout(structure) · binding |
| `transformational` | message_basis=transformational (lifestyle/slice_of_life/mood_image/fantasy) | Puto & Wells (1984) transformational; Belch & Belch / Kotler | visual(scene/register/medium) · intent(aspiration) |
| `social_proof` | testimonial / review-or-comment device dominant | Belch & Belch testimonial; appeal=social_proof (Kotler) | binding(screenshot/quote) · intent(social_proof) |
| `default` | hybrid / uncertain / no dominant type | Puto & Wells (1984) 2×2 hybrid | all axes evenly |

## Lock discipline
DRAFT v0 — pilot the classifier on real KEPT images and lock before the corpus runs
(`acquisition-must-not-outrun-validation-contract`). Every enum ends in `other` (codebase convention). Vocab
additions are pilot-then-lock, never mid-corpus (would invalidate prior aggregates).

## Sources (citable basis)
- **Puto, C. P., & Wells, W. D. (1984).** *Informational and Transformational Advertising: The Differential Effects of Time.* Advances in Consumer Research, 11, 638–643.
- **Belch, G. E., & Belch, M. A.** *Advertising and Promotion: An Integrated Marketing Communications Perspective.* (creative appeals & execution styles.)
- **Kotler, P., & Armstrong, G.** *Principles of Marketing.* (message execution styles.)
- **Frazer, C. F. (1983).** *Creative Strategy: A Management Perspective.* Journal of Advertising, 12(4), 36–41.
- **Vaughn, R. (1980).** *How Advertising Works: A Planning Model* (the FCB grid). Journal of Advertising Research, 20(5), 27–33.

## Pipeline (see the runbook)
The classifier runs after `perception` (text-only, no extra vision) and routes to an adapter that tunes the
per-axis analysts. Canonical procedure: `knowledge/reference/modes/analysis.md`. Axis definitions:
`knowledge/reference/axis-model.md`.
