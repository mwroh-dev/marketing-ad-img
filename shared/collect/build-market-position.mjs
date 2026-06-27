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

if (import.meta.url === `file://${process.argv[1]}`) {
  const [analysisDir, personaId, outArg] = process.argv.slice(2);
  if (!analysisDir || !personaId) {
    console.error("Usage: node shared/collect/build-market-position.mjs <analysisDir> <persona_id> [outPath]");
    process.exit(2);
  }
  const out = buildMarketPosition({ analysisDir: resolve(analysisDir), personaId });
  const outPath = outArg ? resolve(outArg) : resolve(analysisDir, "..", "creative", "market-position-matrix.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`market-position-matrix → ${outPath} (${out.total_ads} ads)`);
}
