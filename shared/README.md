# scripts/

Validation & harness scripts (run with `npx tsx`). **NOT a mode CLI** — the orchestrator runs inside Claude Code. `_lib.ts` holds shared `loadJson`/`writeJson`/`validateAgainst`/`report` (ajv draft 2020-12, memoized).

All validators/drivers **require their input path arg(s)** — no fixture fallback. Each prints a `Usage:` line and exits 2 when invoked without the required arg.

| Script | Flow | What it does |
|---|---|---|
| `validators/validate-request-evaluation.ts` | A | Validates a request-evaluation artifact. |
| `validators/validate-user-answer.ts` | B | Validates a user-answer artifact. |
| `validators/validate-competitor.ts` | gate | `<candidatesPath> <confirmedPath>` → validates scout pool + curator confirmed set. |
| `validators/validate-competitor-collection.ts` | D | `<competitor-collection.json>` → validates the deep-collection deliverable. |
| `validators/validate-ad-creative.ts` | D | `<path>` → validates an ad-creative dataset. |
| `validators/validate-ad-analysis.ts` | analysis | `[--ocr <p>] [--layout <p>] [--copy <p>] [--pattern <p>]` → validates only the artifacts whose paths are passed. |
| `validators/validate-keyword-model.ts` | analysis | `<instancesPath> [modelPath]` → keyword-instance/-model shape + score-sort. |
| `validators/validate-creative-brief.ts` | gen | `<path>` → validates a creative-brief artifact. |
| `validators/validate-copy-layout.ts` | gen | `<path>` → validates a copy-layout artifact. |
| `validators/validate-critic-verdict.ts` | gen | `<path>` → validates a critic-verdict artifact. |
| `validators/validate-candidate.ts` | gen | Validates candidates + selection-log + both adapters; cross-checks Korean copy verbatim. |
| `harness/run-keyword-model.ts` | analysis | `<instancesPath> <corpusPath> [personaPath] [outPath]` → ranked keyword-model (wraps `keyword-rank`). |
| `harness/run-ad-pattern.ts` | analysis | `<layoutAnalysesPath> <copyAnalysesPath> <product_id> [synthesis] [outPath]` → per-persona ad-pattern (wraps `ad-pattern-rank`). |
| `harness/product-cutout-cleanup.ts` | H | `--assets <product-assets.json> [--product-id] [--source] [--out]` → Node cutout/cleanup; degrades to report-only without `sharp`/source image. |

## Live data collection (CDP) — `shared/collect/`

Real browser collection from **public ad-transparency libraries** per the data-collection runbook (`knowledge/reference/modes/data-collection.md`) (Meta Ad Library + Google Ads Transparency — public, no login). Real interactions only (front-door nav + real click/type/search-button); reading DOM allowed; **stop on block** (`lib.isBlocked`). Requires Chrome on a CDP port (acquire a probed-free one via `shared/collect/acquire-port.mjs`, 9223–9299).

| Script | Does |
|---|---|
| `lib.mjs` | CDP helpers: connect, realClick/realType/realScroll, background-tab attach, isBlocked, getResponseBody. Depends on `chrome-remote-interface`. |
| `ad-collect-harness.mjs` | Shared collection harness: CDP lifecycle, image capture, dedup, output schema, block STOP, tab cleanup (source-agnostic). |
| `flows/meta-ad-library/flow.mjs` | Meta Ad Library adapter (`defineFlow`) — public filter URL carve-out. |
| `flows/google-ads-transparency/flow.mjs` | Google Ads Transparency adapter (`defineFlow`) — advertiser search-box resolve. |
| `shared/collect/{define-flow,flow-registry,run-flow}.mjs` | the source contract · registry (dispatch by name) · generic CLI runner. |


Run tests:
```bash
npm install
node --test shared agents
```

Each validator/driver requires real input args, e.g.:
```bash
npx tsx shared/harness/run-keyword-model.ts <instances.json> <corpus.json>
npx tsx shared/validators/validate-creative-brief.ts <creative-brief.json>
```
