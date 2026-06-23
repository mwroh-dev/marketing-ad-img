# data-collection — runbook

The goal is **the AD DATA ITSELF** — we build an ad for the seller's product by learning from the ads that exist
in the product's space (layout, copy, hooks, structure), NOT by fixating on a competitor set. So the PRIMARY
track collects a **broad category/keyword ad corpus** from the public ad-transparency libraries; a confirmed
competitor frame is an **optional enrichment**, not a prerequisite. Detail cuts are analyzed from the
seller's **own / user-provided images** via the image refiner — never collected from third-party stores.
Everything below is governed procedure, scoped to the brand's `target_market` (KR-domestic → Korean ads/sources).

**Steps (for progress reporting, ~5):** 1) `keyword-planner` 3-axis keyword plan + announce → 2) Track 1 keyword corpus collect (dated run, stage=collected) → 3) **human keep/delete review** (HARD GATE, stage=human_reviewed) → 4) deterministic screen (size/dup, stage=screened) → 5) (optional) Track 2 competitor enrichment. Report `[collection · step k/5]` at each.

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
   detail cut (detail-cut = ad) from plain catalog/spec/review/lifestyle cuts → analysis. Not crawled.
```

There is no "own→competitor→category" store-scraping order: ad creatives are public-library only (Meta/Google),
own detail cuts are user-provided. **A run does not need a competitor set to proceed** — Track 1 stands alone.

## Before collecting — seeds (ask first) + source options (let the user pick)

1. **Seed pre-interview** — ask the user FIRST: *"Do you already know any reference competitors, ads, or brands? (Let us know if so)"*. People who
   know the space can hand us references the search would miss — this is the synergy: user seeds + our search, not
   our search alone. Carry seeds with `is_seed: true`; never block on them (empty is fine).
2. **Source options** — when announcing *"I'll now search in parallel"*, present WHERE you'll search as **selectable options**,
   labelled by what each yields + access mode, and let the user choose/adjust:
   - `Meta Ad Library` — ad creatives (keyword + advertiser), public/no-login.
   - `Google Ads Transparency` — ad creatives (advertiser only), public/no-login.
   - `Web search / public reviews` — research signal (who-buys, pains, positioning) from public web + public review pages
     (public store/product pages that appear in search results — **reading only**) — NOT ad-creative scraping of those stores, NOT bulk
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
1. **Dispatch `keyword-planner`** to expand (product, persona) into a broad **3-axis** keyword plan — Needs / Use-case / Adjacency — in the `target_market` language(s). It writes `runs/{run_id}/keyword-plan/keyword-plan-{persona_id}.json` (`keyword-plan.schema.json`) and **announces the keywords per axis** to the user (e.g. "Needs: … / Use-case: … / Adjacency: … — I'll collect with these keywords" — phrased in the consumer's `target_market` language). Goal is coverage (volume), not precision — same-product relevance does not matter (hooks transfer). _(No keyword-plan yet, or a quick run: the deterministic `deriveQueries` cold-start in `scout-rank.mjs` remains as a fallback via the positional query / `--from-model`.)_
2. **Collect** with `${CLAUDE_PLUGIN_ROOT}/shared/collect/run-flow.mjs meta <persona> keyword "" <run> --from-keyword-plan <plan.json>` — Meta Ad Library keyword search returns real ads broadly (not advertiser-bound). Union/dedup across queries. Writes the dated run + `run.json` (stage=collected).
3. Honestly record per-query result counts + coverage in provenance (which keyword, how many ads, what was thin).
   A thin pool → widen keywords / add a source, and SAY SO; never pad or claim a frame you don't have. **Use the platform result-count as a volume signal**: a keyword returning a rich count → expand adjacent terms around it; a 0-result or absurdly-broad keyword → drop it (this is the collection-stage volume control, not a quality filter).

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
2. Meta: navigate directly to the filter URL (public ad-transparency carve-out; query `q` is a runtime
   parameter, validated by matchToolEntry against the whitelist). Google: type into the search box
   (Input.insertText), pick a suggestion, click it — no synthetic Enter, no DOM value injection.
3. On any block/verification page, STOP immediately (lib.isBlocked) — no workaround
4. Scroll to induce lazy loading. Google: this buffers ad-creative image responses
   (Network.responseReceived) for the drain step. Meta: scroll only loads the cards — collection is
   modal-driven (step 5), NOT buffer-driven.
5. [Meta only] MODAL-DRIVEN per-ad collection — see below.
6. [Google only] Drain buffered images via Network.getResponseBody → save images/ad-N.jpg + structured
   creatives (with advertiser provenance). Honestly record no_advertiser_match / no creatives in
   coverage_flags (no false completion). (Meta retired this buffer→drain path — see below.)
```

### Meta: MODAL-DRIVEN per-ad collection (every collected ad gets its detail)

Meta collection is **driven from the modal pass** so that EVERY collected creative is 1:1 with its
detail by construction (target ≈100% detail coverage; live `diet` product example: **24/24**). The OLD two-pass
design (grid scroll buffered creative *network* responses; a separate modal pass built a `metaByKey`
and `drain()` joined them by image-URL key) left ~3/24 creatives detail-less because the
buffered-creative set and the opened-modal set did not perfectly overlap (CDN size-variant url
mismatches + occasional modal-open misses). The fix UNIFIES the passes.

**Enabler (recon §11/§12, live-proven):** fbcdn assets are **token-authed, not cookie-authed** — a
bare Node `fetch` of the FULL signed url (with its `?…oh=…oe=` query) returns the COMPLETE file
(full 200, content-length == bytes): images (`scontent` + `t39.35426` jpg) AND videos (`video-…` mp4).
So each ad's creative can be fetched DIRECTLY by url right after reading it from the open modal — no
dependency on the network buffer.

**Steps (per ad card — all cards, no artificial cap; bounded by the 360s harness timeout + totalCap):**

1. Read the card's creative image asset(s) `{ full (signed, to fetch), key (query-stripped, the
   record id) }` BEFORE opening the modal — the FALLBACK if the modal fails. The advertiser
   AVATAR/logo (a tiny `stp=…s60x60` ~1KB thumbnail) is filtered out by intrinsic size
   (`naturalWidth/Height ≥ 200`, size-token backstop); only real creatives (`s600x600`, 30–50KB) are kept.
2. Open the modal: `el.click()` on the "광고 상세 정보 보기 / See ad details" `div[role="button"]` (real
   element activation — not DOM-value injection). CDP `Input.dispatchMouseEvent` does NOT open it in
   headless (reflow mis-hit); `el.click()` does. Poll `!!DLG` (≤5s); on no-modal, fall to step 6 fallback.
3. Locate the dialog: `[role="dialog"]` whose text contains the *labelled* `Library ID` / `라이브러리 ID`
   (excludes the nav panel's bare "광고 라이브러리"). Scroll page to top, expand the **광고주 정보 /
   About the advertiser accordion** (real CDP click, `scrollIntoView({block:'start'})` — load-bearing;
   `el.click()` does NOT toggle it; retry once, gate on a HAS_FOLLOWER verify).
4. Extract by flat-line regex from `dialog.innerText`: `library_id`, `started_at` (EN `"26 Feb 2026"`
   / KR `"2026. 2. 26.에 게재 시작함"`), `status`, `advertiser_name` (line before "광고"/"Sponsored"),
   `follower_count` (KR `팔로워 N명` / EN `N followers`; 천/만/억, K/M/B), `page_category`, `page_id`,
   `platforms` (icon CSS `mask-position` Y-offsets → offset→name table; unknown → `unknown(<offset>)`),
   `video_duration`. → `normalizeDetail(raw)` → `detail_captured`. Read the modal `<video>.src`
   (a pure DOM read) for video ads — both the stripped `video_url` key and the full signed url.
5. Read THIS ad's creative image asset(s) from the OPEN modal (preferred over the grid card img; a real
   carousel modal shows several → one record per image, all sharing this ad's detail). Close the modal
   (CDP-click the top "Close"/"닫기" control + **verify** it's gone — ESC-only stacks modals and
   corrupts later cards; ESC is fallback).
6. `ctx.collectCreative({ imageKey, imageFull, videoKey, videoFull, meta })` per asset: FETCH the bytes
   by the full signed url, write `images/ad-N.jpg` (+ `videos/ad-N.mp4` for a video ad — the image is
   then the poster), and build ONE record with this ad's detail (`detail_captured:true`). On a fetch
   failure → url-only (no fabricated file). On modal/extract FAILURE → fall back to collecting the
   card's grid `<img>` with `detail_captured:false` — so creative coverage is never worse than before.

**1:1 detail, no mis-join (by construction):** each record is built from its OWN modal pass, so detail
is attached to the right creative by construction — there is no join. A RESOLD creative (two different
ads sharing one agency asset) yields TWO records, each with its OWN correct detail (the old
dedupKey-collision drop is no longer needed and is retired). Live verification: 0 cases of one
`library_id` mapping to >1 advertiser.

**Video ads:** the front-door URL omits `media_type`, so video ads are included. The modal `<video>.src`
is the signed `.mp4` url (a pure DOM read; recon §10). The actual `.mp4` is fetched DIRECTLY by that
full signed url (recon §11a — bare GET returns the complete file) and written to `videos/ad-N.mp4`; the
record is `subtype:"video"` with `video_url` (stripped) + `video_file`, and the poster jpg as
`image_file`. The transient signed url is never persisted (it expires). Live `diet` product example: 4/4 video
records had a saved `video_file` (valid `ftyp` mp4). `getResponseBody` on the 206 video stream is NOT
used (it evicts) — the direct-fetch path replaces it.

**Bounded + safe:** every asset fetch is `downloadImageFile`/`downloadVideoFile` — AbortController
timeout + size ceiling + magic-byte (JPEG/PNG/WEBP/GIF, mp4 `ftyp`) + size-floor validation; never
fabricates a file. Non-intrusive (no bringToFront/activateTarget), STOP-on-block, no URL assembly
(filter front-door whitelisted), signed urls never persisted. The Network buffer/`drain` path stays in
the harness for Google (which still uses scroll→buffer→drain).

Implementation: `${CLAUDE_PLUGIN_ROOT}/shared/collect/ad-collect-harness.mjs` (shared CDP lifecycle, image capture, dedup, block STOP, tab cleanup) + per-source adapter `${CLAUDE_PLUGIN_ROOT}/flows/<source>/flow.mjs` (`defineFlow`), dispatched by name via `${CLAUDE_PLUGIN_ROOT}/shared/collect/flow-registry.mjs` and run by the single `${CLAUDE_PLUGIN_ROOT}/shared/collect/run-flow.mjs`. The adapter supplies only that platform's flow + image matching; the harness owns everything else. See `${CLAUDE_PLUGIN_ROOT}/knowledge/guidelines/ad-source-adapter-contract.md`.

## Browser-flow capture/run (optional replay layer)

A proven collection run can be promoted to a repeatable browser-flow so it can be replayed instead of re-driven by hand. The orchestrator **references the external `.claude` browser-flow skill via `.generate-ads-img/registry/promoted-flows.yaml`** — it **NEVER reimplements** the capture/run logic. The former `browser-flow-capture` / `browser-flow-run` skill wrappers were removed; do not recreate them. `flow-capture` promotes a run into `promoted-flows.yaml`; `run-promoted-flow` looks the flow up there and delegates execution to that external skill.

## Detail-cut analysis (own / user-provided images)

The seller's own product detail-page images are provided by the user (not crawled). The image refiner separates the persuasion detail-cut (= ad) from plain catalog/spec/review/lifestyle cuts, then ad analysis runs on the separated cuts. This is an analysis input, not a collected source.

## Human keep/delete review, THEN a deterministic screen (no LLM in the keep/drop loop)

Collection's job is **volume, not quality** — it over-collects on purpose (a "dirty" but real image ad is a valid hook template; same-product relevance does NOT matter, because hooks transfer across products). Quality/fit is decided **after** collection, by a HUMAN — fast, cheap visual cognition beats an LLM relevance pass here, and it keeps the choices the user actually wants instead of letting a model pre-drop them.

Order (both tracks, after collection):
1. **Human 1st-pass review (HARD GATE) — browser image grid.** The orchestrator runs `node ${CLAUDE_PLUGIN_ROOT}/shared/collect/select-images.mjs {run_id} {persona_id}` **with `run_in_background: true`** (identical for both tracks — they share the on-disk layout, only `{run_id, persona_id}` differ). It renders `ad-creatives/{persona_id}/ad-creative.json` as a static grid (images only; videos excluded), spins a one-shot localhost server on an OS-assigned port (node built-in `http`, no deps), and **blocks**. It prints `SELECT_URL http://127.0.0.1:<port>/` — **relay that URL to the user and tell them to open it in a browser** (no auto-open, to avoid an untestable cross-platform launcher). When relaying, **explain plainly that this is a convenience feature, not a standard Claude Code UI**: it's a local browser grid so the user doesn't have to open the run folder in Finder/Explorer and hunt through image files by hand — they just click the ones to keep. Make clear it runs only on their machine (localhost) and closes itself once they confirm. The user clicks the images to KEEP (default = none selected) and clicks 확인; the page POSTs the kept set, and the server then, in one atomic commit: writes `runs/{run_id}/screening/screen-{persona_id}.json` (`image-screening.schema.json`; kept in `kept[]`, the rest in `dropped[]` with `reason: "user_removed"`), **moves the unselected images to `images/_removed/`** (recoverable, never hard-deleted), advances the run to `human_reviewed`, then self-exits. On that exit the harness re-invokes the orchestrator — read the screen JSON, report counts, and proceed. Analysis MUST NOT start before the run reaches `human_reviewed`. (Fallback if no browser/display is available: present `images/ad-N.jpg` inline via the Read tool — **"Collected N items on [date]. Please choose what to keep and what to delete."** in the consumer's `target_market` language — then write the same screen JSON and `node ${CLAUDE_PLUGIN_ROOT}/shared/collect/advance-stage.mjs {run_id} human_reviewed --kept M`.)
2. **Deterministic screen on the survivors.** `node ${CLAUDE_PLUGIN_ROOT}/shared/collect/screen-images.mjs {run_id} {persona_id} {imagesDir}` — drops only the mechanically-useless (size/dimension/exact duplicate), advances the run to `screened`. **No LLM screener.**
3. Report "N collected → M kept (human) → K normalized (dedup/size) → analysis" — every drop with its reason is provenance, never silent.

The run ledger `run.json.stage` is the real gate (resumable): `collected → human_reviewed → screened → analyzed` (see `check-state.mjs`, which surfaces any run stuck mid-pipeline).

## Outputs (knowledge pipeline: raw → collected → HUMAN-REVIEWED → SCREENED → signal → knowledge)

```
.generate-ads-img/runs/{run_id}/ad-creatives/{persona_id}/ad-creative.json + images/   + runs/{run_id}/run.json (stage=collected)
  (${CLAUDE_PLUGIN_ROOT}/schemas/collection/ad-creative.schema.json; source ∈ {meta_ad_library, google_ads_transparency})
→ HUMAN keep/delete review → screening/screen-{persona_id}.json (kept | dropped reason:user_removed)   ← HARD GATE (stage=human_reviewed)
→ screen-images.mjs (deterministic: size/dim/duplicate) → merges drops into screen-{persona_id}.json       ← no LLM (stage=screened)
→ ad analysis on KEPT only (ocr → copy ⊥ layout → ad-pattern + keyword)                                    ← (stage=analyzed)
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
