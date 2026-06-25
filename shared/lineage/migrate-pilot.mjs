// Phase-4 proof: persist the real pilot analysis chains (_pilot/flow/ad-N/) into the global lineage store, each
// artifact wrapped with its correct derived_from chain + pattern_tag + a real logic_version. Demonstrates the store
// on real data; the live analysis pipeline will call persistArtifact the same way (see provenance-lineage.md).
//
// Usage: node shared/lineage/migrate-pilot.mjs [pilotDir]   (default .generate-ads-img/_pilot/flow)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { persistArtifact, slotOf, analysisPatternTag, refOf } from "./persist-artifact.mjs";

// the analysis pipeline structure → each kind's parents (the chain). perception is the root.
const CHAIN = {
  perception: [],
  "ad-type": ["perception"],
  copy: ["perception"],
  layout: ["perception"],
  visual: ["perception"],
  intent: ["copy", "layout", "visual"],
  strategy: ["ad-type", "intent", "visual", "copy"],
  "ad-type-gate": ["ad-type", "strategy", "visual", "copy"],
};
const KIND_FILE = { perception: "perception.json", "ad-type": "ad-type.json", copy: "copy.json", layout: "layout.json", visual: "visual.json", intent: "intent.json", strategy: "strategy.json", "ad-type-gate": "ad-type-gate.json" };
const PRODUCER = { perception: "perception-extractor", "ad-type": "ad-type-classifier", copy: "copy-analyst", layout: "layout-analyst", visual: "visual-analyst", intent: "intent-analyst", strategy: "strategy-projector", "ad-type-gate": "ad-type-gate" };

export function migratePilot({ pilotDir, ads, stateDir, now, logicVersionFn } = {}) {
  const dirAds = ads || (existsSync(pilotDir) ? readdirSync(pilotDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []);
  const persisted = [];
  for (const ad of dirAds) {
    const dir = resolve(pilotDir, ad);
    const read = (k) => { const p = resolve(dir, KIND_FILE[k]); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : undefined; };
    const perception = read("perception");
    if (!perception?.image_ref || !perception?.persona_id) continue;        // need identity to key it
    const image_ref = perception.image_ref;
    const m = String(image_ref).match(/^runs\/([^/]+)\//);
    const key = { persona_id: perception.persona_id, image_ref, run_id: m ? m[1] : undefined };
    const slot = slotOf(key);
    const pattern_tag = analysisPatternTag(read("strategy"), read("ad-type"));
    for (const kind of Object.keys(CHAIN)) {
      const payload = read(kind);
      if (!payload) continue;
      const derived_from = CHAIN[kind].filter((pk) => read(pk)).map((pk) => ({ kind: pk, ref: refOf(key.persona_id, slot, pk) }));
      const { ref } = persistArtifact({ kind, key, payload, derived_from, pattern_tag, produced_by: PRODUCER[kind] }, { stateDir, now, logicVersionFn });
      persisted.push({ ad, kind, ref, pattern_tag });
    }
  }
  return persisted;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const stateDir = process.env.GEN_ADS_IMG_STATE || resolve(process.cwd(), ".generate-ads-img");
  const pilotDir = process.argv[2] || resolve(stateDir, "_pilot/flow");
  const persisted = migratePilot({ pilotDir, stateDir });
  const byAd = {};
  for (const p of persisted) (byAd[p.ad] ||= []).push(p.kind);
  console.log(`persisted ${persisted.length} envelopes into ${resolve(stateDir, "store")}`);
  for (const [ad, kinds] of Object.entries(byAd)) console.log(`  ${ad} [${persisted.find((p) => p.ad === ad).pattern_tag}] → ${kinds.join(", ")}`);
}
