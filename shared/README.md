# scripts/

Validation & harness scripts (run with `npx tsx`). **NOT a mode CLI** — the orchestrator runs inside Claude Code. `_lib.ts` holds shared `loadJson`/`writeJson`/`validateAgainst`/`report` (ajv draft 2020-12, memoized).

`shared/tools/` is the canonical ToolSpec catalog and Claude Code MCP adapter for the deterministic callable boundaries in this folder. The catalog names the tool surface, records the current script/module implementation, and exposes P0 tools through the plugin-bundled MCP server. Its bootstrap prepares runtime npm dependencies under `${CLAUDE_PLUGIN_DATA}` instead of relying on shipped `node_modules`.

Schemas are **single-sourced from TypeBox**: `schemas/<stage>/<name>.ts` → `schemas/build.ts` emits the `.schema.json` (the validator's; regenerated, parity-equivalent) + the lean `.view.md` (what agents `@`-import; ~40-50% fewer tokens) + per-consumer projections. Validators load the regenerated `.schema.json`; agents read the view.

All validators/drivers **require their input path arg(s)** — no fixture fallback. Each prints a `Usage:` line and exits 2 when invoked without the required arg.

| Script | Flow | What it does |
|---|---|---|
| `validators/validate-request-evaluation.ts` | A | Validates a request-evaluation artifact. |
| `validators/validate-user-answer.ts` | B | Validates a user-answer artifact. |
| `validators/validate-competitor.ts` | gate | `<candidatesPath> <confirmedPath>` → validates scout pool + curator confirmed set. |
| `validators/validate-competitor-collection.ts` | D | `<competitor-collection.json>` → validates the deep-collection deliverable. |
| `validators/validate-ad-creative.ts` | D | `<path>` → validates an ad-creative dataset. |
| `validators/validate-ad-analysis.ts` | analysis | `[--perception <p>] [--layout <p>] [--copy <p>] [--pattern <p>] [--creative-snapshot <p>] ...` → validates only the artifacts whose paths are passed. |
| `validators/validate-keyword-model.ts` | analysis | `<instancesPath> [modelPath]` → keyword-instance/-model shape + score-sort. |
| `validators/validate-creative-brief.ts` | gen | `<path>` → validates a creative-brief artifact. |
| `validators/validate-copy-layout.ts` | gen | `<path>` → validates a copy-layout artifact. |
| `validators/validate-critic-verdict.ts` | gen | `<path>` → validates a critic-verdict artifact. |
| `validators/validate-candidate.ts` | gen | Validates candidates + selection-log + both adapters; cross-checks Korean copy verbatim. |
| `harness/run-keyword-model.ts` | analysis | `<instancesPath> <corpusPath> [personaPath] [outPath]` → ranked keyword-model (wraps `keyword-rank`). |
| `harness/run-ad-pattern.ts` | analysis | `<layoutAnalysesPath> <copyAnalysesPath> <product_id> [synthesis] [outPath]` → per-persona ad-pattern (wraps `ad-pattern-rank`). |
| `harness/product-cutout-cleanup.ts` | H | `--assets <product-assets.json> [--product-id] [--source] [--out]` → Node cutout/cleanup; degrades to report-only without `sharp`/source image. |
| `collect/build-market-position.mjs` | analysis | `<analysisDir> <persona_id> [out]` → benefit×funnel **market-position matrix** as a pure function of the per-ad strategy projections (code, never a model's summary). |
| `collect/creative-change-agent-eval.mjs` | analysis | Programmatic gate for `temporal-change-analyst` outputs: schema validation, candidate-id references, number fidelity, no-context inferred gating, and positive overclaim rejection without failing on disclaimers. |
| `collect/subagent-projection-guard.mjs` | orchestration | Pure guard for materialized subagent handoffs: rejects raw media/browser traces/credentials/other-persona leaks except for the agents explicitly allowed to receive raw media. |
| `harness/build-creative-snapshot.mjs` | analysis | `<persona_id> <run_id> [out_run_id]` → `creative-change/creative-snapshot.{run_id}.json` from `ad-creative.json` + durable store envelopes. |
| `harness/compare-creative-snapshots.mjs` | analysis | `<from_snapshot.json> <to_snapshot.json> [out.json]` → computed `creative-diff.json`. |
| `harness/detect-change-candidates.mjs` | analysis | `<creative-diff.json> [out.json]` → deterministic `change-candidates.json`. |
| `harness/render-change-report.mjs` | analysis | `<creative-change-report.json> [out.html]` → validates payload and renders escaped HTML. |
| `harness/validate-subagent-projection.mjs` | orchestration | `<agent_name> <handoff.json> [--persona <id>]` → CLI wrapper around the projection guard for dispatch-time checks. |
| `harness/close-analysis.mjs` | analysis | `<run_id> [stateDir]` → the analysis tail in **one command**: persist per-ad lineage store envelopes (`persist-analysis-run`) + freeze that run's `creative-snapshot` while the store is run-current + advance the run ledger to `analyzed`. Reads the analysts' per-kind staging; the store is never hand-written. |
| `harness/normalize-artifact.mjs` | gen | `<kind> <file>` → **role-aware** shape normalizer for drift-prone agents: judgment artifacts (`critic-verdict`) are schema-whitelisted; creative artifacts (`creative-brief`) strip only known meta. Content is never rewritten — only the envelope is conformed. |
| `harness/finalize-candidates.ts` | gen | `--copy <copy-layout.json> --chatgpt <…> --gemini <…> --out <…>` → joins the real agent outputs into `creative-candidates.json` + `candidate-selection-log.json` (deterministic; no LLM). |

### Runtime conformance gates (the teeth)
The schemas are enforced at runtime, not just declared. Two gates refuse non-conformant work before it ships — they cannot stop the LLM orchestrator from improvising, but an improvised artifact cannot proceed:
| Gate | Flow | What it does |
|---|---|---|
| `harness/validate-store.ts` | analysis | `<persona_id> [stateDir]` → every persisted store artifact must be a complete, provenance-stamped lineage envelope. A raw payload / hand-written partial / missing `logic_version` → `STORE FAIL` (exit 1), blocking generation. |
| `harness/validate-gen-run.ts` | gen | `<run_dir>` → every artifact a generation run produced (opportunity · brief · copy-layout · matrix · critic-verdict · adapter outputs · candidates) conforms to its schema. A drifted/extra-field/improvised shape → `GEN-RUN FAIL` (exit 1) before candidates are presented. |

## Live data collection (CDP) — `shared/collect/`

Real browser collection from **public ad-transparency libraries** per the data-collection runbook (`knowledge/reference/modes/data-collection.md`) (Meta Ad Library + Google Ads Transparency — public, no login). Real interactions only (front-door nav + real click/type/search-button); reading DOM allowed; **stop on block** (`lib.isBlocked`). **`run-flow.mjs` owns the full browser lifecycle in code** — `acquire-port.mjs` (probed-free port, 9223–9299) → `launch-chrome.mjs` (dedicated headless, isolated `--user-data-dir`, non-intrusive) → connect → collect → `close()` in `finally`. No manual Chrome launch.

| Script | Does |
|---|---|
| `lib.mjs` | CDP helpers: connect, realClick/realType/realScroll, background-tab attach, isBlocked, getResponseBody. Depends on `chrome-remote-interface`. |
| `ad-collect-harness.mjs` | Shared collection harness: CDP lifecycle, image capture, dedup, output schema, block STOP, tab cleanup (source-agnostic). |
| `acquire-port.mjs` · `launch-chrome.mjs` | probe a free CDP port (9223–9299) · spawn a dedicated headless Chrome on it (isolated profile, non-intrusive) + `close()`. |
| `flows/meta-ad-library/flow.mjs` | Meta Ad Library adapter (`defineFlow`) — public filter URL carve-out. |
| `flows/google-ads-transparency/flow.mjs` | Google Ads Transparency adapter (`defineFlow`) — advertiser search-box resolve. |
| `shared/collect/{define-flow,flow-registry,run-flow}.mjs` | source contract · registry (dispatch by name) · generic CLI runner that **self-launches the browser** (acquire-port → launch-chrome → collect → close). |


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
