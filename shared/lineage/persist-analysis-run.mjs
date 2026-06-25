// Live glue: persist a completed analysis run's per-image artifacts into the global lineage store, each wrapped
// with its correct derived_from chain + pattern_tag + logic_version. The orchestrator runs this after the analysis
// stage (the analysts write per-ad artifacts to a staging dir `{analysisDir}/{ad}/{kind}.json`); this turns the
// documented persist step (modes/analysis.md) into a real call. migrate-pilot.mjs is the pilot-specific caller.
//
// Usage: node shared/lineage/persist-analysis-run.mjs <analysisDir> [stateDir]
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { persistArtifact, slotOf, analysisPatternTag, refOf } from "./persist-artifact.mjs";

// the analysis pipeline structure → each kind's parents (the chain). perception is the root.
export const CHAIN = {
  perception: [],
  "ad-type": ["perception"],
  copy: ["perception"],
  layout: ["perception"],
  visual: ["perception"],
  intent: ["copy", "layout", "visual"],
  strategy: ["ad-type", "intent", "visual", "copy"],
  "ad-type-gate": ["ad-type", "strategy", "visual", "copy"],
};
export const KIND_FILE = { perception: "perception.json", "ad-type": "ad-type.json", copy: "copy.json", layout: "layout.json", visual: "visual.json", intent: "intent.json", strategy: "strategy.json", "ad-type-gate": "ad-type-gate.json" };
const PRODUCER = { perception: "perception-extractor", "ad-type": "ad-type-classifier", copy: "copy-analyst", layout: "layout-analyst", visual: "visual-analyst", intent: "intent-analyst", strategy: "strategy-projector", "ad-type-gate": "ad-type-gate" };

// analysisDir holds one subdir per ad: {analysisDir}/{ad}/{kind}.json (raw artifacts). Returns the persisted refs.
export function persistAnalysisRun({ analysisDir, stateDir, now, logicVersionFn } = {}) {
  const ads = existsSync(analysisDir) ? readdirSync(analysisDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  const persisted = [];
  for (const ad of ads) {
    const dir = resolve(analysisDir, ad);
    const read = (k) => { const p = resolve(dir, KIND_FILE[k]); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : undefined; };
    const perception = read("perception");
    if (!perception?.image_ref || !perception?.persona_id) continue;        // need identity to key it
    const m = String(perception.image_ref).match(/^runs\/([^/]+)\//);
    const key = { persona_id: perception.persona_id, image_ref: perception.image_ref, run_id: m ? m[1] : undefined };
    const slot = slotOf(key);
    const pattern_tag = analysisPatternTag(read("strategy"), read("ad-type"));
    for (const kind of Object.keys(CHAIN)) {
      const payload = read(kind);
      if (!payload) continue;
      const derived_from = CHAIN[kind].filter((pk) => read(pk)).map((pk) => ({ kind: pk, ref: refOf(key.persona_id, slot, pk) }));
      const { ref } = persistArtifact({ kind, key, payload, derived_from, pattern_tag, produced_by: PRODUCER[kind] }, { stateDir, now, logicVersionFn });
      persisted.push({ ad, slot, kind, ref, pattern_tag });
    }
  }
  return persisted;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const analysisDir = process.argv[2];
  const stateDir = process.argv[3] || process.env.GEN_ADS_IMG_STATE || resolve(process.cwd(), ".generate-ads-img");
  if (!analysisDir) { console.error("Usage: node shared/lineage/persist-analysis-run.mjs <analysisDir> [stateDir]"); process.exit(2); }
  const persisted = persistAnalysisRun({ analysisDir, stateDir });
  const byAd = {};
  for (const p of persisted) (byAd[p.slot] ||= []).push(p.kind);
  console.log(`persisted ${persisted.length} envelopes into ${resolve(stateDir, "store")}`);
  for (const [slot, kinds] of Object.entries(byAd)) console.log(`  ${slot} [${persisted.find((p) => p.slot === slot).pattern_tag}] → ${kinds.join(", ")}`);
}
