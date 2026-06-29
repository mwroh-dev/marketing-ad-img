// Deterministic market-position-matrix builder — the analysis-tail glue that replaces the orchestrator
// improvising a matrix by hand (the live E2E shipped a non-conformant, hand-shaped one). Reads the analysts'
// real per-kind output layout (`{analysisDir}/strategy/strategy-{N}.json` + `{analysisDir}/type/type-{N}.json`,
// N = ad index), joins each into a record (toRecord), crosses them into the benefit×funnel matrix
// (aggregateMarketPosition), stamps persona identity, and writes a `market-position-matrix.schema.json`-conformant
// file. No LLM — the matrix is a pure function of the per-ad strategy projections, so it must come from code.
//
// Usage: node shared/collect/build-market-position.mjs <analysisDir> <persona_id> [outPath]
//   → writes the matrix to outPath (default: <analysisDir>/../creative/market-position-matrix.json) + prints it.
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateMarketPosition, toRecord } from "./market-position-aggregate.mjs";
import { loadMatrixInputs } from "../lineage/read-store.mjs";

// Ad indices come from the strategy dir (`strategy-{N}.json`) — strategy is the matrix's unit of evidence, so an
// ad without one is simply not a record (no fake data). ad-type lives in the `type/` dir (the analyst names it
// `type-{N}.json`, not `ad-type`).
export function buildMarketPosition({ analysisDir, personaId, now }) {
  const stratDir = resolve(analysisDir, "strategy");
  const indices = existsSync(stratDir)
    ? readdirSync(stratDir).map((f) => /^strategy-(\d+)\.json$/.exec(f)?.[1]).filter((x) => x != null).map(Number).sort((a, b) => a - b)
    : [];
  const readKind = (dir, prefix, i) => { const p = resolve(analysisDir, dir, `${prefix}-${i}.json`); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : undefined; };
  const records = [];
  for (const i of indices) {
    const strategy = readKind("strategy", "strategy", i);
    if (!strategy) continue;
    records.push(toRecord(strategy, readKind("type", "type", i) || {}));
  }
  const matrix = aggregateMarketPosition(records);
  // market-position-matrix.schema.json is CLOSED and is persona-keyed (no product_id field) — emit exactly its
  // shape: persona identity + the aggregate + a timestamp. (Adding product_id is what the live improvised file did.)
  return { persona_id: personaId, ...matrix, generated_at: now ?? new Date().toISOString() };
}

// Store-backed variant — the generation-time builder. Reads the per-ad strategy/ad-type from the DURABLE lineage
// store (not a collection run's scratch), so generation depends only on what analysis PERSISTED. loadMatrixInputs
// THROWS when the store is empty/absent → this is the code interlock: no provenanced store ⇒ no matrix ⇒ generation
// cannot proceed. The matrix is identical to the scratch path (same toRecord/aggregate); only the source differs.
export function buildMarketPositionFromStore({ persona, stateDir, now }) {
  const { strategies, adTypes } = loadMatrixInputs(persona, { stateDir });   // throws on an empty/missing store
  const adTypeByRef = {};
  for (const a of adTypes) adTypeByRef[a.image_ref] = a;
  const records = strategies.map((s) => toRecord(s, adTypeByRef[s.image_ref] || {}));
  const matrix = aggregateMarketPosition(records);
  return { persona_id: persona, ...matrix, generated_at: now ?? new Date().toISOString() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  if (argv[0] === "--from-store") {
    // Generation-time mode: build the matrix from the durable store. Exits non-zero (the interlock) if unpersisted.
    const [, persona, outArg] = argv;
    if (!persona) {
      console.error("Usage: node shared/collect/build-market-position.mjs --from-store <persona_id> [outPath]");
      process.exit(2);
    }
    let out;
    try { out = buildMarketPositionFromStore({ persona }); }
    catch (e) { console.error(`market-position (store): ${e.message}`); process.exit(1); }
    const outPath = outArg ? resolve(outArg) : resolve(".generate-ads-img", "runs", "gen-from-store", "creative", "market-position-matrix.json");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
    console.log(`market-position-matrix (from store) → ${outPath} (${out.total_ads} ads)`);
  } else {
    const [analysisDir, personaId, outArg] = argv;
    if (!analysisDir || !personaId) {
      console.error("Usage: node shared/collect/build-market-position.mjs <analysisDir> <persona_id> [outPath]\n   or: node shared/collect/build-market-position.mjs --from-store <persona_id> [outPath]");
      process.exit(2);
    }
    const out = buildMarketPosition({ analysisDir: resolve(analysisDir), personaId });
    const outPath = outArg ? resolve(outArg) : resolve(analysisDir, "..", "creative", "market-position-matrix.json");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
    console.log(`market-position-matrix → ${outPath} (${out.total_ads} ads)`);
  }
}
