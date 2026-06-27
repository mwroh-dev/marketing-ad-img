// Live glue: persist a completed analysis run's per-image artifacts into the global lineage store, each wrapped
// with its correct derived_from chain + pattern_tag + logic_version. The orchestrator runs this after the analysis
// stage; it reads the analysts' real per-KIND output layout `{analysisDir}/{dir}/{dir}-{N}.json` (N = ad index),
// turning the documented persist step (modes/analysis.md) into a real call. migrate-pilot.mjs is the pilot caller.
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
// store kind → the analyst's on-disk dir (= file prefix): perception is written to `ocr/`, ad-type to `type/`,
// the rest match their kind. File name is `{dir}-{N}.json`. A kind whose dir is absent (e.g. ad-type-gate when
// the gate did not run) is simply skipped — no fake data.
export const KIND_DIR = { perception: "ocr", "ad-type": "type", copy: "copy", layout: "layout", visual: "visual", intent: "intent", strategy: "strategy", "ad-type-gate": "ad-type-gate" };
const PRODUCER = { perception: "perception-extractor", "ad-type": "ad-type-classifier", copy: "copy-analyst", layout: "layout-analyst", visual: "visual-analyst", intent: "intent-analyst", strategy: "strategy-projector", "ad-type-gate": "ad-type-gate" };

// Ad indices come from the perception (ocr) dir — perception is the chain root and carries the identity we key on.
export function persistAnalysisRun({ analysisDir, stateDir, now, logicVersionFn } = {}) {
  const ocrDir = resolve(analysisDir, KIND_DIR.perception);
  const indices = existsSync(ocrDir)
    ? readdirSync(ocrDir).map((f) => /-(\d+)\.json$/.exec(f)?.[1]).filter((x) => x != null).map(Number).sort((a, b) => a - b)
    : [];
  const readKind = (k, i) => { const d = KIND_DIR[k]; const p = resolve(analysisDir, d, `${d}-${i}.json`); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : undefined; };
  const persisted = [];
  for (const i of indices) {
    const perception = readKind("perception", i);
    if (!perception?.image_ref || !perception?.persona_id) continue;        // need identity to key it
    const m = String(perception.image_ref).match(/runs\/([^/]+)\//);
    const key = { persona_id: perception.persona_id, image_ref: perception.image_ref, run_id: m ? m[1] : undefined };
    const slot = slotOf(key);
    const pattern_tag = analysisPatternTag(readKind("strategy", i), readKind("ad-type", i));
    for (const kind of Object.keys(CHAIN)) {
      const payload = readKind(kind, i);
      if (!payload) continue;
      const derived_from = CHAIN[kind].filter((pk) => readKind(pk, i)).map((pk) => ({ kind: pk, ref: refOf(key.persona_id, slot, pk) }));
      const { ref } = persistArtifact({ kind, key, payload, derived_from, pattern_tag, produced_by: PRODUCER[kind] }, { stateDir, now, logicVersionFn });
      persisted.push({ ad: `ad-${i}`, slot, kind, ref, pattern_tag });
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
