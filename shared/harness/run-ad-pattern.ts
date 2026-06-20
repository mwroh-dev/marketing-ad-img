// Harness: assemble a per-persona ad-pattern from layout + copy analyses.
// Usage: tsx scripts/run-ad-pattern.ts <layoutAnalysesPath> <copyAnalysesPath> <product_id> [synthesis] [outPath]
import { loadJson, writeJson, validateAgainst, report } from "../_lib.ts";
import { aggregatePattern } from "../collect/ad-pattern-rank.mjs";

const layoutPath = process.argv[2];
const copyPath = process.argv[3];
const productId = process.argv[4];
if (!layoutPath || !copyPath || !productId) { console.error("Usage: tsx shared/harness/run-ad-pattern.ts <layoutAnalysesPath> <copyAnalysesPath> <product_id> [synthesis] [outPath]"); process.exit(2); }
const synthesis = process.argv[5];
const outPath = process.argv[6] ?? ".generate-ads-img/runs/ad-pattern-dry/ad-pattern.json";

const layout = loadJson<any>(layoutPath);
const copy = loadJson<any>(copyPath);
const agg = aggregatePattern({ layoutAnalyses: layout.analyses, copyAnalyses: copy.analyses });

const pattern: any = {
  product_id: productId,
  persona_id: layout.persona_id,
  ...agg,
  generated_at: new Date().toISOString(),
};
if (synthesis) pattern.synthesis = synthesis;
if (agg.image_count < 3) pattern.confidence_note = `thin corpus (${agg.image_count} images)`;

writeJson(outPath, pattern);
const ok = report("ad-pattern written", validateAgainst("ad-pattern.schema.json", pattern));
console.log(`  → ${outPath} (top composition: ${pattern.composition_top_k[0]?.value ?? "n/a"})`);
process.exit(ok ? 0 : 1);
