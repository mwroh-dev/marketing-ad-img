# Ad-strategy taxonomy — the grounded marketing-reasoning projection

System-design reference for the **strategy-projection** layer: how a *completed* per-ad analysis is projected into
practical marketing-strategy dimensions (purchase reason × buyer stage, message clarity, customer language,
reusable devices). It is **domain-neutral** (every enum value is illustrative across product domains, never an
assumed product/persona, per `non-negotiable-rules.md`).

**Relationship to `ad-taxonomy.md`:** `ad-taxonomy.md` (Puto & Wells / Belch & Belch / Kotler / Frazer) stays the
**primary analysis taxonomy** — it answers *"what kind of advertising execution is this?"*. This doc is an
**auxiliary marketing-strategy grounding** — it answers *"what purchase reason and buyer-readiness position does
this ad occupy, and how usable is it?"*. It is a derived **projection**, not a replacement taxonomy.

## Why (the gap this fills)
Analysis identifies *what technique* an ad uses (e.g. `testimonial`) but not *why that technique was chosen* —
what purchase reason it creates, at what buyer stage, and whether it actually communicates. That per-ad marketing
reasoning is the missing bridge between analysis and generation. It is read for **every** collected ad, on the
ad's **own product's selling-point** (never our product's lens — that would be a prejudice mirror); our product's
selling-point enters only later, at the creative-opportunity stage (ring ③).

## Placement (ring line — same as axis-model.md)
- **strategy-projector (per-ad) + market-position-aggregate (corpus matrix) = ring ②, analysis side.** A derived,
  brand-free fact about the analyzed ad, reusable across many downstream uses.
- **creative-opportunity-mapper ("what should *we* make") = ring ③, generation side.**

## Provenance principle (this doc is the citable basis)
Each dimension is grounded in established marketing science with an explicit `(Author, Year)` citation. The rule:
a strategy-projection field must trace to a source here via `grounds_in`. No external lecture/notes file is
imported or referenced — only the reusable *structure* is encoded as neutral schema terms.

## Projection rule (project from existing analysis — do NOT re-classify)
The two aggregatable axes already exist in `intent-analysis`. strategy-projector **projects**, it does not
re-classify:
- `funnel_intent` ⟵ `intent.funnel_stage` (1:1): discovery⟵awareness · comparison⟵consideration · action⟵conversion · retention⟵retargeting.
- `benefit_vector` ⟵ a coarsening of `intent.appeal` + copy/visual/binding evidence (see mapping below).
The genuinely new value is the **2-D benefit × funnel matrix** (the joint, which the 1-D `ad-pattern` marginals cannot give), plus the per-ad clarity / language / reusability reads.

## The dimensions (each grounded)

### benefit_vector — the purchase reason the ad creates
`function | cost | trust | symbol | unclear` (`unclear` = insufficient evidence; not a category).
Grounded in **Sheth, Newman & Gross (1991)** Theory of Consumption Values and **Park, Jaworski & MacInnis (1986)**
functional/symbolic/experiential brand concepts. The 4-way is an **explicit synthesis** (not one paper's exact set):

| value | definition | grounded in |
|---|---|---|
| `function` | specs, mechanism, direct result, convenience, time saving (utilitarian performance) | Sheth-Newman-Gross *functional value*; Park *functional* |
| `cost` | price, discount, substitute-cost, prevention/failure/time cost (value-for-money, perceived sacrifice) | Zeithaml (1988) perceived value (benefit − sacrifice) |
| `trust` | expert/institution/certification/numeric proof/review/guarantee (risk reduction, credibility) | perceived risk (Bauer 1960) + source credibility |
| `symbol` | identity, taste, lifestyle, belonging, self-image, aspiration | Sheth-Newman-Gross *social+emotional*; Park *symbolic+experiential* |
Projection seed: `appeal` price/convenience→function · price/scarcity→cost · social_proof/authority/quality_proof→trust · aspiration→symbol (evidence-confirmed, not mechanical).

### funnel_intent — the buyer-readiness stage the ad targets
`discovery | comparison | action | retention | unclear`. Grounded in **Lavidge & Steiner (1961)** Hierarchy of
Effects (awareness→knowledge→liking→preference→conviction→purchase; cognitive·affective·conative); `retention`
extends it via the modern loyalty-loop (consumer decision journey). 1:1 projection of `intent.funnel_stage`.

| stage | the ad's move | grounded in |
|---|---|---|
| `discovery` | problem/situation/empathy/cause framing ("this is your issue") | Lavidge-Steiner cognitive (awareness/knowledge) |
| `comparison` | proof, criteria, superiority, alternatives, why-this-product | Lavidge-Steiner affective (liking/preference) |
| `action` | buy-now, CTA, urgency, offer, stock, trial | Lavidge-Steiner conative (conviction/purchase) |
| `retention` | routine, repurchase, bundle, replenishment, referral | loyalty-loop (post-purchase) |

### first_cognition — does the ad communicate in the first glance
Eight 0-2 sub-scores → `total_score` 0-16 → `verdict` (strong 13-16 / acceptable 9-12 / weak 5-8 / unusable 0-4).
Grounded in **Petty & Cacioppo (1986)** Elaboration Likelihood Model — an ad is first met under **low elaboration /
peripheral processing** (a few seconds, a "cognitive miser" with limited resources), so what is grasped instantly
matters — and the advertising-comprehension literature (Jacoby & Hoyer, ad comprehension/miscomprehension).
Sub-scores: target_clarity · situation_clarity · problem_clarity · product_category_clarity · benefit_clarity ·
reading_load · jargon_penalty · visual_legibility. `total_score` MUST equal the sum of the eight.

### customer_language — whose words the copy uses
`detected_phrases` (real customer speech) · `brand_language_phrases` (supplier-side / abstract / jargon) ·
`review_like_phrases` (from reviews/comments/testimonials). Grounded in **Griffin & Hauser (1993)** *The Voice of
the Customer* (Marketing Science) + Jobs-to-Be-Done — customers persuade in their own vernacular, distinct from
boardroom marketer-speak.

### generation_reusability — what can be reused vs must not be copied
`usable` (bool) · `reusable_devices[]` (abstract devices) · `avoid_copying[]` (competitor-specific claims/assets/
wording) · `reason`. Grounded in **Goldenberg, Mazursky & Solomon (1999)** *The Fundamental Templates of Quality
Ads* (Marketing Science 18(3):333-351) — successful ads share **abstract, reusable creativity templates**; the
reusable thing is the *template*, never the competitor's specific content. `usable = true` only if the structure
adapts without copying competitor-specific claims, assets, testimonials, or distinctive wording.

### market position — the corpus matrix (aggregate)
The per-ad `(benefit_vector, funnel_intent)` pairs are crossed into a **benefit × funnel matrix**; cells are
labeled `crowded` (high observed frequency) / `whitespace` (low frequency — *not* a guaranteed opportunity).
Grounded in **Ries & Trout (1981)** Positioning + perceptual mapping (crowded vs open positions) and
**Kim & Mauborgne (2005)** Blue Ocean Strategy (whitespace = value innovation). NOT a performance report —
frequency/longevity is "observed prevalence / longevity proxy", never claimed as performance.

## Lock discipline
DRAFT v0 — pilot the projector on real analyzed ads and lock before the corpus runs
(`acquisition-must-not-outrun-validation-contract`). Evidence-based fields use `unclear` for insufficient
evidence (semantics: "not enough to decide", not "uncategorized"). Vocab additions are pilot-then-lock.

## Sources (citable basis)
- **Sheth, J. N., Newman, B. I., & Gross, B. L. (1991).** Why We Buy What We Buy: A Theory of Consumption Values. Journal of Business Research, 22(2), 159–170.
- **Park, C. W., Jaworski, B. J., & MacInnis, D. J. (1986).** Strategic Brand Concept-Image Management. Journal of Marketing, 50(4), 135–145.
- **Zeithaml, V. A. (1988).** Consumer Perceptions of Price, Quality, and Value. Journal of Marketing, 52(3), 2–22.
- **Lavidge, R. J., & Steiner, G. A. (1961).** A Model for Predictive Measurements of Advertising Effectiveness. Journal of Marketing, 25(6), 59–62.
- **Petty, R. E., & Cacioppo, J. T. (1986).** The Elaboration Likelihood Model of Persuasion. Advances in Experimental Social Psychology, 19, 123–205.
- **Griffin, A., & Hauser, J. R. (1993).** The Voice of the Customer. Marketing Science, 12(1), 1–27.
- **Goldenberg, J., Mazursky, D., & Solomon, S. (1999).** The Fundamental Templates of Quality Ads. Marketing Science, 18(3), 333–351.
- **Ries, A., & Trout, J. (1981).** Positioning: The Battle for Your Mind. + **Kim, W. C., & Mauborgne, R. (2005).** Blue Ocean Strategy.

## Pipeline (see the runbooks)
strategy-projector runs after `pattern-synthesizer` (analysis, text-only); market-position-aggregate crosses the
corpus; creative-opportunity-mapper consumes the matrix at generation. Procedures:
`knowledge/reference/modes/analysis.md` + `knowledge/reference/modes/image-generation.md`. Axis defs: `axis-model.md`.
Execution taxonomy (primary): `ad-taxonomy.md`.
