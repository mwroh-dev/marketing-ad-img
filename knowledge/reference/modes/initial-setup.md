# initial-setup — runbook

When this mode is active, the orchestrator establishes baseline domain knowledge + registry state for a new
brand / product / per-product persona before any collection or generation can run. The defining principle is
**data-first synergy**: the user supplies the TARGET (pointers + intent); the system supplies the DATA
(parallel research). Both must exist — user-only is a "cheap signboard," data-only ignores the seller's goal.
So the orchestrator NEVER interrogates the user for category/persona free-form; it collects pointers, researches,
then presents **evidence-backed candidates as choices**.

## Flow (5 steps)

### 1. Collect pointers from the user (minimal)
Drive the interview (`interview-controller`) only to get the **hard-blocker pointers** — keep questions easy:
- **brand_name**, **product_list**, **product_url_or_where_sold** (the seller's own product page URL and/or where it's sold).
- **target_market** — *"Is your target audience domestic (Korea), overseas, or both?"* → `{scope, regions, languages}`. This is decisive: it scopes ALL downstream research/ad/competitor queries to the right market + language. A domestic-only seller must not be handed foreign-only companies (e.g. a US-only brand) as competitors, and ad search runs in the target market's language.
- Plus one OPTIONAL prompt: *"Is there anything else you'd like to share about your brand or product?"* → `user_target_memo` (the user's intent/target; informs, never blocks).
Structure each answer via the `user-answer-tooling` skill. Persist to `.generate-ads-img/brands/{brand_id}/user-input.json`.
Do NOT ask the user to define product_category / personas / positioning here — those are derived next.

### 2. Announce + dispatch parallel research
Once the pointers are in, tell the user plainly: **"I'll now search in parallel on my end."** (shown in the consumer's `target_market` language). Then dispatch
`brand-researcher` **in parallel, one per angle** (the orchestrator fans them out; do not serialize):
- `page` — fetch the user's `product_url` (public) → product facts, USP wording, on-page claims.
- `reviews` — WebSearch + WebFetch PUBLIC reviews/comments → who buys, recurring pains/desires, buyers' own words → `persona_candidates`.
- `positioning` — WebSearch → category framing, premium-vs-value, competitor context → `category_candidates` + `positioning_signals`.
Each `brand-researcher` is projected ONLY its pointers + its one angle (never the full knowledge set). Public/no-login
only · non-intrusive CDP · STOP-on-block · no fabrication (see `${CLAUDE_PLUGIN_ROOT}/agents/brand-researcher.md`).

### 3. Aggregate + persist (both halves)
Collect each angle's findings (`schema brand-research`) into `.generate-ads-img/brands/{brand_id}/research/findings-{angle}.json`.
Now the project folder holds BOTH the user's input AND the researched data — the synergy is on disk, queryable, not
just in conversation. Honest `coverage_flags` are kept, not hidden.

### 4. Derive candidates → interview presents CHOICES → user confirms
Merge the angles' `category_candidates` + `persona_candidates` (each evidence-grounded). Hand them to
`interview-controller`, which presents them as **selectable options** (never free-form): e.g. *"Based on the review data, these personas emerged — 1) … 2) … 3) … Which fits? (Edit/add as needed)"* (shown in the consumer's `target_market` language). The user picks/edits/confirms. If research came
back thin (coverage_flags dominate), say so honestly and ask the user for a better source rather than guessing.

### 5. Write the confirmed brand/product/persona state
On confirmation, write `.generate-ads-img/brands/{brand_id}/` brand-profile + per-product profile + the confirmed
persona(s) under `brands/{brand_id}/products/{product_id}/personas/` (this is what `check-state.mjs` reads as
`setup_complete`). `forbidden_claims` is seeded from the researched claim risks + user confirmation.

## Product assets (when needed)
When a product asset needs a clean cutout PNG for downstream image-generation, run the deterministic
product-cutout-cleanup script (`${CLAUDE_PLUGIN_ROOT}/shared/harness/product-cutout-cleanup.ts`; policy:
`${CLAUDE_PLUGIN_ROOT}/knowledge/reference/product-cutout-policy.md`) and record it in
`.generate-ads-img/registry/product-assets.yaml`. `image-prompt-adapter` consumes that cutout via the registry.

## Gate
initial-setup completes when the pointers are in, parallel research ran (or its gaps are flagged + the user
supplied what was missing), and a **confirmed** brand/product/persona + registry are written. Only then may
`data-collection` or `image-generation` be dispatched for that brand/product/persona.
