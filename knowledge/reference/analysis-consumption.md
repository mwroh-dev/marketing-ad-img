# Analysis consumption — atomic vs compound, and what to gather

System-design reference for **how downstream agents consume the analysis store**, and the rule for *when to
pre-combine (gather) information vs let a consumer select it*. This exists so that when a consumer is added or
changed, the classification is made deliberately against a recorded criterion — not re-improvised.

## The store and the consumers
The analysis store is the set of per-image + per-persona artifacts (perception, ad-type, copy, layout, visual,
intent, bindings, strategy-projection; ad-pattern, market-position-matrix). **The image is opened once** (perception,
the vision pass). Every other agent consumes *text* — a slice of the store, never the pixels.

The store is the **image's substitute** (see `axis-model.md` → "The schema IS the image substitute"). So every
load-bearing fact carries `value + evidence + confidence`; a consumer reads the **confidence** to decide *trust the
schema vs re-look* — it never blindly trusts a summary. Low confidence / absence is surfaced, never hidden.

## The criterion (one line)
> **Gather (pre-combine in CODE) ONLY when the combination is a *synthesized fact* — a relationship or an aggregate
> that exists only after combining (e.g. which text binds which graphic; a frequency/positioning matrix). If a
> consumer merely needs *several pieces at once* (no new fact in the combination), do NOT gather — let it select
> each. NEVER build an LLM-summarized bundle (a summary re-words facts → it is a new hallucination point that
> propagates uncaught).**

So a consumer is one of:
- **atomic** — needs one slice of one artifact → it selects, no gathering.
- **compound (pile)** — needs several conclusions but uses them independently → still selects each, no gathering.
- **compound (synthesized)** — needs a *relationship/aggregate over* the pieces → that synthesized fact is computed
  once in code and stored as its own artifact (this is the only case that earns "gather").

A "handoff" in the systems sense is just the transfer boundary + the data contract that crosses it; the question
at each boundary is "what must cross so the receiver works without re-opening the image / re-deriving?". The
answer here is: a deterministic **selection** of the store (atomic / pile), or a deterministic **synthesized
artifact** (the gather case) — never an LLM summary.

## Consumer map (current)
| consumer | needs (actual fields) | class | gather? |
|---|---|---|---|
| `copy-analyst` | perception `text_elements[].content` | atomic | no — select |
| `layout-analyst` | perception `text_elements[].bbox/font_size_scale` + `graphic_elements` + `canvas.aspect_ratio` | atomic | no — select |
| `visual-analyst` | perception `medium` + `scene` + `look` + `canvas.dominant_colors` | atomic | no — select |
| `ad-type-classifier` | perception `text_elements.content` + `medium` + `scene` + `look` | atomic-broad (one artifact) | no — select |
| `intent-analyst` | copy + layout + visual conclusions + **bindings** | compound | only **bindings** (a synthesized relationship); the 3 conclusions are selected |
| `strategy-projector` | ad-type + intent(appeal/funnel) + visual(register) + copy(language) + advertiser meta | compound (pile) | no — selects conclusions; no new synthesized fact |
| `pattern-synthesizer` | the `ad-pattern` aggregate | consumes a gathered artifact | (ad-pattern is the gather) |
| `creative-opportunity-mapper` | `market-position-matrix` + our product/persona | consumes a gathered artifact | (matrix is the gather) |
| `creative-brief-analyst` | `creative-opportunity` + brand/product/persona | consumes a gathered artifact | (opportunity is the gather) |

## What we currently gather (and why each earns it)
- **bindings** (`bbox-bind.mjs`) — which text sits on which graphic: a *relationship* that only exists after crossing text+graphic bboxes. Code.
- **ad-pattern** (`ad-pattern-rank.mjs`) — per-persona frequency aggregates: a *synthesis over many images*. Code.
- **market-position-matrix** (`market-position-aggregate.mjs`) — benefit×funnel 2-D positioning: a *joint* the 1-D marginals cannot give. Code.

No general "bundle everything" artifact exists — by design. Most consumers are atomic selections; the few real
synthesized facts are already computed in code.

## Guidance — adding or changing a consumer
1. List the *actual fields* it reasons over (not "the analysis").
2. Classify: atomic / compound-pile / compound-synthesized (per the criterion above).
3. If compound-synthesized, add the synthesized artifact as a **code** aggregate (mirror `bbox-bind`/`ad-pattern-rank`),
   schema-validated, with confidence/coverage flags — never an LLM summary.
4. If atomic or compound-pile, it selects from the store; project only the fields it needs (subagent-projection.md Context
   Distribution Rule). Carry confidence so the consumer can BLOCK / escalate on low-confidence rather than guess.
5. Record the decision here so a future change is reasoned against this map, not re-improvised.

See: `axis-model.md` (the axes + cost invariant), `modes/analysis.md` (the pipeline order).
