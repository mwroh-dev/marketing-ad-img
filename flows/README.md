# flows/ — per-source dedicated CDP collection flows (domain-specific)

Each subdirectory is a **dedicated CDP flow for one ad/data source** — the site-specific navigation,
search, expand, paginate, and extract sequence for that source. They are the **domain-specific** half of
collection; the **source-agnostic** half (CDP browser primitives + the collection harness) lives in
`shared/collect/` and is imported by every flow.

| flow | source | shape |
|---|---|---|
| `meta-ad-library/` | Meta Ad Library (public) | `META` adapter → shared `ad-collect-harness` (public-filter front-door, advertiser search) |
| `google-ads-transparency/` | Google Ads Transparency (public) | `GOOGLE` adapter → shared `ad-collect-harness` (real search box, autocomplete click) |

Shared, imported from `../../shared/collect/`: `lib.mjs` (CDP interaction), `launch-chrome.mjs` (browser
lifecycle), `acquire-port.mjs` (port), `ad-collect-harness.mjs` (collection loop + no-URL-assembly whitelist),
`ad-search-queries.mjs`, `ad-source-helpers.mjs`. Browser lifecycle for every flow:
acquire-port → launch-chrome → connect → collect → `close()` in finally. STOP-on-block, no bypass.

## How a flow is wired (since the layering refactor)
Each source is `flows/<source>/flow.mjs` = `export default defineFlow({ name, source, entrypoints, config, imgMatch, collect(ctx) })`.
- **Contract**: `shared/collect/define-flow.mjs` (safe defaults; new source needs only name+entrypoints+collect).
- **Registry**: `shared/collect/flow-registry.mjs` — `getFlow(name)` / `getEnabledFlows()` (dispatch by name).
- **Runner**: `shared/collect/run-flow.mjs <flow> <persona> …` — one generic CLI for all sources.
- **Layer rule**: a `flow.mjs` touches ONLY `ctx` (+ pure helpers like `ad-source-helpers`); never imports `lib.mjs` directly.
