// Harness: assemble a per-persona market-position matrix from strategy-projections (+ ad-type classifications).
// Usage: tsx shared/harness/run-market-position.ts <strategiesPath> <adtypesPath> <persona_id> [outPath]
//   strategiesPath: envelope { persona_id, analyses: [ strategy-projection, ... ] }
//   adtypesPath:    envelope { analyses: [ ad-type, ... ] }  (joined to strategies by image_ref)
import { loadJson, writeJson, validateAgainst, report } from "../_lib.ts";
import { aggregateMarketPosition, toRecord } from "../collect/market-position-aggregate.mjs";

const strategiesPath = process.argv[2];
const adtypesPath = process.argv[3];
const personaId = process.argv[4];
if (!strategiesPath || !personaId) { console.error("Usage: tsx shared/harness/run-market-position.ts <strategiesPath> <adtypesPath> <persona_id> [outPath]"); process.exit(2); }
const outPath = process.argv[5] ?? ".generate-ads-img/runs/market-position-dry/market-position-matrix.json";

const strategies = loadJson<any>(strategiesPath).analyses || [];
const adTypes = adtypesPath ? (loadJson<any>(adtypesPath).analyses || []) : [];
const adTypeByRef: Record<string, any> = {};
for (const a of adTypes) adTypeByRef[a.image_ref] = a;

const records = strategies.map((s: any) => toRecord(s, adTypeByRef[s.image_ref] || {}));
const matrix: any = { persona_id: personaId, ...aggregateMarketPosition(records), generated_at: new Date().toISOString() };

writeJson(outPath, matrix);
const ok = report("market-position-matrix written", validateAgainst("market-position-matrix.schema.json", matrix));
console.log(`  → ${outPath} (${matrix.total_ads} ads · ${matrix.crowded_positions.length} crowded · ${matrix.whitespace_positions.length} whitespace)`);
process.exit(ok ? 0 : 1);
