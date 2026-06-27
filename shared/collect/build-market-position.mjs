// Deterministic market-position-matrix builder — the analysis-tail glue that replaces the orchestrator
// improvising a matrix by hand (the live E2E shipped a non-conformant, hand-shaped one). Reads the per-ad
// staging artifacts the analysts wrote (`{analysisDir}/{ad}/{strategy.json,ad-type.json}`), joins each into a
// record (toRecord), crosses them into the benefit×funnel matrix (aggregateMarketPosition), stamps persona/
// product identity, and writes a `market-position-matrix.schema.json`-conformant file. No LLM — the matrix is
// a pure function of the per-ad strategy projections, so it must come from code, not a model's summary.
//
// Usage: node shared/collect/build-market-position.mjs <analysisDir> <persona_id> [outPath]
//   → writes the matrix to outPath (default: <analysisDir>/../creative/market-position-matrix.json) + prints it.
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateMarketPosition, toRecord } from "./market-position-aggregate.mjs";

// analysisDir holds one subdir per ad: {analysisDir}/{ad}/{strategy.json, ad-type.json}. Build one record per ad
// that has a strategy projection (the matrix's unit of evidence); ads without one are skipped (no fake data).
export function buildMarketPosition({ analysisDir, personaId, now }) {
  const ads = existsSync(analysisDir)
    ? readdirSync(analysisDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];
  const records = [];
  for (const ad of ads) {
    const read = (f) => { const p = resolve(analysisDir, ad, f); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : undefined; };
    const strategy = read("strategy.json");
    if (!strategy) continue;
    records.push(toRecord(strategy, read("ad-type.json") || {}));
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
  const out = buildMarketPosition({ analysisDir: resolve(analysisDir), personaId, productId });
  const outPath = outArg ? resolve(outArg) : resolve(analysisDir, "..", "creative", "market-position-matrix.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`market-position-matrix → ${outPath} (${out.total_ads} ads)`);
}
