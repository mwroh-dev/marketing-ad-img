# 01. Knowledge Architecture

## Core Distinction

Knowledge splits into two classes by **location** and two by **nature**.

```txt
Plugin knowledge (released, reusable) — ${CLAUDE_PLUGIN_ROOT}/knowledge/
  guidelines/   guidelines: upfront principles & techniques (brand-agnostic)
  experience/   experience: reusable patterns generalized from runs (cross-brand)
Consumer state (per-consumer, runtime, gitignored) — .generate-ads-img/
  brands/, runs/, registry/   specific brands/products/competitors/collected ads
```

Plugin knowledge persists in the repo (the same for whoever installs it). Consumer state is created at runtime in **the installer's working directory** and is not included in the release. Mixing the two causes the agent to treat a specific case as a universal principle, or to persist one consumer's brand facts into the plugin. (Scripts: in `${CLAUDE_PLUGIN_ROOT}/shared/_lib.ts`, `ROOT` = plugin, `STATE_DIR` = `.generate-ads-img/`.)

## Global Knowledge

Laws, principles, techniques, methodologies, and paradigms that apply repeatedly regardless of brand.

Examples:

- AIDA, PAS, BAB, JTBD
- social proof, scarcity, contrast, specificity
- copywriting hook/objection handling
- visual hierarchy, grid, focal point, text density
- Meta ad format principles
- image prompting principles
- agentic-principles
- browser-flow usage principles

Storage:

```txt
${CLAUDE_PLUGIN_ROOT}/knowledge/guidelines/
  marketing-techniques/
  copywriting-techniques/
  layout-principles/
  ad-format-principles/
  image-prompt-principles/
  agentic-principles/
```

## Domain Knowledge

Data tied to a specific brand/product/market/competitor/category.

Examples:

- brand philosophy
- brand tone & manner
- product USP
- per-product claim constraints
- review signal
- per-product persona
- competitor ad patterns
- purchase resistance in a specific category
- image/copy response for a specific product group

Storage:

```txt
.generate-ads-img/
  brands/{brand_id}/
    brand-profile.md
    brand-constraints.md
    products/{product_id}/
      product-profile.md
      product-claims.md
      personas/{persona_id}/  persona.json
        creative-history/                  # per-persona ad creative history
        competitors/  competitors.json   # confirmed per-persona competitor set (${CLAUDE_PLUGIN_ROOT}/schemas/collection/competitor.schema.json)
        keyword-model.json                 # per-persona functional-slot keyword ranking (${CLAUDE_PLUGIN_ROOT}/schemas/analysis/keyword-model.schema.json)
        ad-pattern.json                    # per-persona competitor ad composition pattern (${CLAUDE_PLUGIN_ROOT}/schemas/analysis/ad-pattern.schema.json)
  category-patterns/                       # ORDER 3, brand-level
```

Competitors live **under the persona, not brand-wide**. Even for the same product, the competitive landscape differs per persona (e.g., exam-taker–silent operation vs. parent–child's tool), so the competitor set is separated per persona. Only category patterns stay at the brand level.

## Brand/Product/Persona Cardinality

```txt
Brand 1
  └─ Product N
       └─ Persona N
```

A brand may have multiple products.  
Each product may have multiple personas.

## Update Rule

Raw data does not directly become knowledge.

```txt
raw source
→ collected artifact
→ extracted signal
→ reviewed summary
→ knowledge update candidate
→ knowledge commit
```

All updates must preserve evidence references.
