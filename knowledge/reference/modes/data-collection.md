# data-collection — runbook

The goal is **the AD DATA ITSELF** — we build an ad for the seller's product by learning from the ads that exist
in the product's space (layout, copy, hooks, structure), NOT by fixating on a competitor set. So the PRIMARY
track collects a **broad category/keyword ad corpus** from the public ad-transparency libraries; a confirmed
competitor frame is an **optional enrichment**, not a prerequisite. Detail cuts (상세컷) are analyzed from the
seller's **own / user-provided images** via the image refiner — never collected from third-party stores.
Everything below is governed procedure, scoped to the brand's `target_market` (KR-domestic → Korean ads/sources).

**Steps (for progress reporting, ~4):** 1) seeds + source options → 2) Track 1 keyword corpus collect → 3) screening (keep/drop) → 4) (optional) Track 2 competitor enrichment. Report `[수집 · 단계 k/4]` at each.

## Collection tracks

```
TRACK 1 — category/keyword ad corpus  (PRIMARY · ungated · this is "the ad data itself")
   Meta Ad Library KEYWORD search on the product category × {feature/audience/benefit} cues
   (scoped to target_market language/region) → a broad pool of real ads → layout/copy patterns.
   Runs WITHOUT a competitor gate. This is the main signal the generation pipeline learns from.

TRACK 2 — competitor/advertiser ads   (OPTIONAL enrichment · gated by curator confirm)
   Used when the user wants a competitor frame or provides seeds. discovery-scout (advertiser
   candidates) → competitor-curator (HARD GATE: user confirms the set) → collect those advertisers'
   ads (Meta advertiser + Google advertiser). Enriches the corpus; never blocks Track 1.

INPUT (not a collected source) — own detail cuts
   The seller's OWN / user-provided detail-page images → image refiner separates the persuasion
   detail cut (상세컷 = ad) from plain catalog/spec/review/lifestyle cuts → analysis. Not crawled.
```

There is no "own→competitor→category" store-scraping order: ad creatives are public-library only (Meta/Google),
own detail cuts are user-provided. **A run does not need a competitor set to proceed** — Track 1 stands alone.

## Before collecting — seeds (ask first) + source options (let the user pick)

1. **Seed pre-interview** — ask the user FIRST: *"이미 아는 참고 경쟁사·광고·브랜드가 있나요? (있으면 알려주세요)"*. People who
   know the space can hand us references the search would miss — this is the synergy: user seeds + our search, not
   our search alone. Carry seeds with `is_seed: true`; never block on them (empty is fine).
2. **Source options** — when announcing *"이제 병렬로 찾아볼게요"*, present WHERE you'll search as **selectable options**,
   labelled by what each yields + access mode, and let the user choose/adjust:
   - `Meta 광고 라이브러리` — ad creatives (keyword + advertiser), public/no-login.
   - `Google 광고 투명성` — ad creatives (advertiser only), public/no-login.
   - `웹검색 / 공개 리뷰` — research signal (who-buys, pains, positioning) from public web + public review pages
     (네이버·쿠팡·스마트스토어 등 검색에 뜨는 **공개 페이지 읽기**) — NOT ad-creative scraping of those stores, NOT bulk
     pagination. Reading what a person sees, STOP-on-block.
   Default to Meta-keyword (Track 1) + the user's chosen extras. Each option's access boundary is the legal line —
   ad creatives only from the public ad-transparency libraries; commerce stores are research/review reading only.
3. **Report the trail** — per `${CLAUDE_PLUGIN_ROOT}/knowledge/guidelines/completion-verification-policy.md`
   (provenance / search-trail reporting): show where·what query·counts·locations·what-was-missing, never a thin summary.

## Required state the orchestrator confirms before running

```yaml
required_slots:
  - brand_id
  - source_target_id          # the public ad-library source (meta_ad_library | google_ads_transparency)
  - access_mode               # public (ad libraries are public, no login)
  - collection_goal
  - cdp_port
  - flow_mode                 # discovery | adlib-collection | detail-cut-analysis | flow-capture | run-promoted-flow
```

Submodes the orchestrator may route into: `discovery` (explore a new public-library source UI via CDP), `adlib-collection` (collect from Meta / Google), `detail-cut-analysis` (refine + analyze own/user-provided detail cuts), `flow-capture` / `run-promoted-flow` (the replay layer below).

## Track 1 — category/keyword ad corpus (PRIMARY, no gate)

This is the default and runs immediately — it does NOT wait on a competitor set:
1. Derive category keyword queries (deterministic): product category × {feature/audience/benefit} cues, in the
   `target_market` language(s), via `deriveQueries` in `${CLAUDE_PLUGIN_ROOT}/shared/collect/scout-rank.mjs`.
2. Collect with `${CLAUDE_PLUGIN_ROOT}/shared/collect/run-flow.mjs meta <persona> keyword "<query>" <run>` — Meta
   Ad Library keyword search returns real ads broadly (not advertiser-bound). Union/dedup across queries.
3. Honestly record per-query result counts + coverage in provenance (which keyword, how many ads, what was thin).
   A thin pool → widen keywords / add a source, and SAY SO; never pad or claim a frame you don't have.

## Track 2 — competitor/advertiser enrichment (OPTIONAL, curator HARD GATE for the competitor set only)

Run this when the user wants a competitor frame or supplies seeds — it enriches Track 1, never blocks it:

1. **Dispatch `discovery-scout`** to find candidate competitors/advertisers (ad-library advertiser search +
   user-provided seeds — never third-party store scraping), scoped to `target_market` so foreign-only companies
   are not surfaced for a domestic seller.
2. **Dispatch `competitor-curator`** to curate/confirm the set. For the COMPETITOR set this is a **HARD GATE**
   (the user confirms before competitor ads are collected). Meta accepts keyword + advertiser queries; Google
   accepts advertiser-name queries only (resolve via the search box, exact > prefix > loose; skip on
   `no_advertiser_match`). This gate governs ONLY Track 2 — Track 1 has already produced the corpus.

## CDP browser lifecycle (code, not manual)

Every collection run owns its browser through code — no manual Chrome launch:

1. `acquirePort(<task>)` (`${CLAUDE_PLUGIN_ROOT}/shared/collect/acquire-port.mjs`) — a probed-FREE port (avoids external collisions).
2. `launchChrome({ port, userDataDir })` (`${CLAUDE_PLUGIN_ROOT}/shared/collect/launch-chrome.mjs`) — a **dedicated headless** Chrome on that port with an **isolated `--user-data-dir`** (non-intrusive: no window, never the user's profile). Public ad libraries need no login → a throwaway dir.
3. `connect(port)` / `openBackgroundTab(port)` (`${CLAUDE_PLUGIN_ROOT}/shared/collect/lib.mjs`) — attach; collectors drive a background tab.
4. collect (real search/click/scroll + `getResponseBody`), `isBlocked` → STOP.
5. **`chrome.close()` in a `finally`** — a leaked headless Chrome accumulates orphan tabs and degrades. Always close.

## Ad-library collection procedure (real CDP interaction only)

```
1. Enter the public ad-library front door (a whitelisted entrypoint in config/tool-entrypoints.yaml)
   via gotoTool — never assemble a result/pagination URL by hand
2. Real search: type the keyword / advertiser name into the search box (Input.insertText),
   pick a suggestion by name-match, click it (no synthetic Enter, no DOM value injection)
3. On any block/verification page, STOP immediately (lib.isBlocked) — no workaround
4. Scroll to induce lazy loading → buffer ad-creative image responses (Network.responseReceived)
5. Drain buffered images via Network.getResponseBody → save images/ad-N.jpg + structured creatives
6. Honestly record no_advertiser_match / no creatives in coverage_flags (no false completion)
```

Implementation: `${CLAUDE_PLUGIN_ROOT}/shared/collect/ad-collect-harness.mjs` (shared CDP lifecycle, image capture, dedup, block STOP, tab cleanup) + per-source adapter `${CLAUDE_PLUGIN_ROOT}/flows/<source>/flow.mjs` (`defineFlow`), dispatched by name via `${CLAUDE_PLUGIN_ROOT}/shared/collect/flow-registry.mjs` and run by the single `${CLAUDE_PLUGIN_ROOT}/shared/collect/run-flow.mjs`. The adapter supplies only that platform's flow + image matching; the harness owns everything else. See `${CLAUDE_PLUGIN_ROOT}/knowledge/guidelines/ad-source-adapter-contract.md`.

## Browser-flow capture/run (optional replay layer)

A proven collection run can be promoted to a repeatable browser-flow so it can be replayed instead of re-driven by hand. The orchestrator **references the external `.claude` browser-flow skill via `.generate-ads-img/registry/promoted-flows.yaml`** — it **NEVER reimplements** the capture/run logic. The former `browser-flow-capture` / `browser-flow-run` skill wrappers were removed; do not recreate them. `flow-capture` promotes a run into `promoted-flows.yaml`; `run-promoted-flow` looks the flow up there and delegates execution to that external skill.

## Detail-cut analysis (own / user-provided images)

The seller's own product detail-page images are provided by the user (not crawled). The image refiner separates the persuasion detail cut (상세컷 = ad) from plain catalog/spec/review/lifestyle cuts, then ad analysis runs on the separated cuts. This is an analysis input, not a collected source.

## Screening BEFORE analysis (don't burn tokens on junk)

Collection over-collects (logos, UI chrome, unrelated/broken/duplicate images). **Before** the expensive analysis
pipeline (~5 LLM calls per image), run `ad-image-screener` (cheap keep/drop verdict per image) so only real,
relevant ad creatives reach analysis. Report to the user "N장 수집 → M장 유효 → 분석, K장 제외(사유별)" — the dropped
list with reasons is part of the provenance trail, never silent. Only `kept` images go downstream.

## Outputs (knowledge pipeline: raw → collected → SCREENED → signal → knowledge)

```
.generate-ads-img/runs/{run_id}/ad-creatives/{persona_id}/ad-creative.json + images/
  (${CLAUDE_PLUGIN_ROOT}/schemas/collection/ad-creative.schema.json; source ∈ {meta_ad_library, google_ads_transparency})
→ ad-image-screener → screening/screen-{persona_id}.json (kept | dropped+reason)   ← cheap gate
→ ad analysis on KEPT only (ocr → copy ⊥ layout → ad-pattern + keyword)
→ ad-pattern.json / keyword-model.json on the persona node
```

## Rules the orchestrator holds the line on

- Ad creatives come from **public ad-transparency libraries only** (Meta, Google) — public, no login, no third-party-store scraping.
- Detail cuts are the seller's **own / user-provided images** (refiner) — never collected from competitor stores.
- On block or verification, STOP immediately. No workaround, stealth, or captcha solving. No URL assembly.
- The public ad-library **filter URL is allowed** (the tool's own interface) only on whitelisted host+path; result deep-links are rejected; search is by real type→click.
- Never promote raw creatives directly to knowledge — pass through collected → signal → commit, preserving evidence.
- Any credentials are never exposed to agents/artifacts — reference profile_id/port only.

## Authoritative invariants

The hard invariants (public-ad-library scope, STOP-on-block/no-bypass, no-URL-assembly, no-DOM-injection, credentials-never-in-artifacts) are **authoritative in `${CLAUDE_PLUGIN_ROOT}/knowledge/reference/non-negotiable-rules.md`** and code-enforced (`${CLAUDE_PLUGIN_ROOT}/shared/collect/lib.mjs` `isBlocked` STOP-on-block; `matchToolEntry` no-URL-assembly whitelist in `ad-collect-harness.goto`). This runbook is the procedure; the rules layer is the source of truth.
