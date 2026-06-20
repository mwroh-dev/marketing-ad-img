// Harness: assemble a ranked keyword-model from ad-analyst instances + corpus.
// Usage: tsx scripts/run-keyword-model.ts <instancesPath> <corpusPath> [personaPath] [outPath]
import { loadJson, writeJson, validateAgainst, report } from "../_lib.ts";
import { computeStats, scoreKeywords, rankByGroup } from "../collect/keyword-rank.mjs";

const instancesPath = process.argv[2];
const corpusPath = process.argv[3];
if (!instancesPath || !corpusPath) { console.error("Usage: tsx shared/harness/run-keyword-model.ts <instancesPath> <corpusPath> [personaPath] [outPath]"); process.exit(2); }
const personaPath = process.argv[4];
const outPath = process.argv[5] ?? ".generate-ads-img/runs/keyword-model-dry/keyword-model.json";

const instances = loadJson<any>(instancesPath);
const corpus = loadJson<any>(corpusPath);
const persona = personaPath ? loadJson<any>(personaPath) : { language_cues: [] };
const weights = { tf: 0.4, df: 0.4, cue: 0.2 };
const competitorCount = corpus.competitor_count ?? (corpus.docs?.length ?? 0);

const stats = computeStats(instances.instances, corpus);
const scored = scoreKeywords(stats, persona, competitorCount, weights);
const groups = rankByGroup(scored, 10);

const model: any = {
  product_id: instances.product_id,
  persona_id: instances.persona_id,
  corpus: { competitor_count: competitorCount, source: corpus.source ?? "titles+detail" },
  weights,
  groups,
  generated_at: new Date().toISOString(),
};
if (competitorCount < 3) model.confidence_note = `thin corpus (${competitorCount} competitors) — df low-confidence`;

writeJson(outPath, model);
const ok = report("keyword-model written", validateAgainst("keyword-model.schema.json", model));
console.log(`  → ${outPath} (${groups.length} slots)`);
process.exit(ok ? 0 : 1);
