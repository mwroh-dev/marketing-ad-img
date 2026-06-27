// Store conformance gate — the teeth behind the deterministic persist glue. Every persisted artifact in a
// persona's lineage store MUST be a COMPLETE envelope (artifact-envelope.schema.json: kind + key + payload +
// derived_from + pattern_tag + logic_version + produced_by + stamped_at), never a raw analyst payload and never
// a partial hand-written one. If the orchestrator improvised the store (wrote raw strategy payloads, or envelopes
// missing their provenance) instead of running close-analysis, this FAILS (exit 1) and generation must not
// proceed on un-provenanced data. We cannot force the orchestrator to run the glue; we CAN refuse to let an
// improvised store ship. No LLM.
//
// Usage: tsx shared/harness/validate-store.ts <persona_id> [stateDir]
//   → PASS/FAIL per store artifact; exit 0 iff every artifact is a complete envelope, else 1.
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { loadJson, validateAgainst, report } from "../_lib.ts";

const persona = process.argv[2];
if (!persona) { console.error("Usage: tsx shared/harness/validate-store.ts <persona_id> [stateDir]"); process.exit(2); }
const stateDir = resolve(process.argv[3] ?? process.env.GEN_ADS_IMG_STATE ?? resolve(process.cwd(), ".generate-ads-img"));
const storeDir = resolve(stateDir, "store", persona);

if (!existsSync(storeDir)) { console.error(`(no store for persona '${persona}' at ${storeDir} — nothing persisted)`); process.exit(1); }

// every *.json under store/{persona} except the index rollup is a lineage envelope and must conform.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = resolve(dir, e);
    if (statSync(p).isDirectory()) return walk(p);
    return e.endsWith(".json") && e !== "index.json" ? [p] : [];
  });
}

const files = walk(storeDir);
if (files.length === 0) { console.error(`(store/${persona} has no envelopes — analysis did not persist)`); process.exit(1); }

let failures = 0;
const adsSeen = new Set<string>();
for (const f of files) {
  const rel = f.slice(storeDir.length + 1); // {ad}/{kind}.json
  adsSeen.add(rel.split("/")[0]);
  if (!report(rel, validateAgainst("artifact-envelope.schema.json", loadJson(f)))) failures++;
}

console.log(failures === 0
  ? `\nSTORE PASS — ${files.length} envelopes across ${adsSeen.size} ad(s) all complete`
  : `\nSTORE FAIL — ${failures}/${files.length} artifacts are not complete envelopes (raw payload / missing provenance → the persist glue did not run). Re-run close-analysis on the analysis dir; do not hand-write the store.`);
process.exit(failures === 0 ? 0 : 1);
