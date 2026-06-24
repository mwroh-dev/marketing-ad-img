// Harness: assemble a per-persona ad-pattern from layout + copy (+ optional visual + intent) analyses.
// Usage: tsx scripts/run-ad-pattern.ts <layoutAnalysesPath> <copyAnalysesPath> <product_id> [synthesis] [outPath]
//        [--visual <visualAnalysesPath>] [--intent <intentAnalysesPath>]
import { loadJson, writeJson, validateAgainst, report } from "../_lib.ts";
import { aggregatePattern, longevityWeights, weightByImageRef } from "../collect/ad-pattern-rank.mjs";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}
// positional args, skipping flag pairs
const positional = process.argv.slice(2).filter((a, idx, arr) => !a.startsWith("--") && !(idx > 0 && arr[idx - 1].startsWith("--")));
const [layoutPath, copyPath, productId, synthesis, outPathArg] = positional;
if (!layoutPath || !copyPath || !productId) { console.error("Usage: tsx shared/harness/run-ad-pattern.ts <layoutAnalysesPath> <copyAnalysesPath> <product_id> [synthesis] [outPath] [--visual <path>] [--intent <path>]"); process.exit(2); }
const outPath = outPathArg ?? ".generate-ads-img/runs/ad-pattern-dry/ad-pattern.json";

const layout = loadJson<any>(layoutPath);
const copy = loadJson<any>(copyPath);
const visualPath = flag("--visual");
const intentPath = flag("--intent");
const visualAnalyses = visualPath ? loadJson<any>(visualPath).analyses : [];
const intentAnalyses = intentPath ? loadJson<any>(intentPath).analyses : [];

// Optional Phase-6 longevity weighting: --creatives <ad-creative.json> --today <YYYY-MM-DD>. Partial coverage by
// design — only detail-captured creatives carry `started_at`; the rest get the neutral weight 1 (never dropped).
const creativesPath = flag("--creatives");
const today = flag("--today");
let weightOf: any = null;
let coverageNote: string | undefined;
if (creativesPath && today) {
  const creatives = loadJson<any>(creativesPath).creatives || [];
  weightOf = weightByImageRef(longevityWeights(creatives, today));
  const dated = creatives.filter((c: any) => c.started_at).length;
  coverageNote = `longevity-weighted (today=${today}); started_at coverage ${dated}/${creatives.length} creatives — undated weighted neutrally`;
}
const agg = aggregatePattern({ layoutAnalyses: layout.analyses, copyAnalyses: copy.analyses, visualAnalyses, intentAnalyses, weightOf });

const pattern: any = {
  product_id: productId,
  persona_id: layout.persona_id,
  ...agg,
  generated_at: new Date().toISOString(),
};
if (synthesis) pattern.synthesis = synthesis;
const notes = [agg.image_count < 3 ? `thin corpus (${agg.image_count} images)` : null, coverageNote].filter(Boolean);
if (notes.length) pattern.confidence_note = notes.join("; ");

writeJson(outPath, pattern);
const ok = report("ad-pattern written", validateAgainst("ad-pattern.schema.json", pattern));
console.log(`  → ${outPath} (top composition: ${pattern.composition_top_k[0]?.value ?? "n/a"})`);
process.exit(ok ? 0 : 1);
