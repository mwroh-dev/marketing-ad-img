// Harness: assemble a per-persona competitive trend from ALL dated collection snapshots of that persona.
// Deterministic; no LLM, no network. A "snapshot" is one collection run's ad-creative.json; re-collecting
// over time (into distinct run ids) accumulates the series this reads. Longevity (running_days) works from a
// single snapshot via started_at; new/disappeared/cadence fill in once ≥2 dated snapshots exist.
//
// Usage: tsx shared/harness/run-competitive-trend.ts <persona_id> <out_run_id> [today_iso] [synthesis]
import { readdirSync, existsSync } from "node:fs";
import { STATE_DIR, statePath, loadState, writeState, validateAgainst, report } from "../_lib.ts";
import { aggregateTrend } from "../collect/competitive-trend.mjs";

const personaId = process.argv[2];
const outRunId = process.argv[3];
if (!personaId || !outRunId) {
  console.error("Usage: tsx shared/harness/run-competitive-trend.ts <persona_id> <out_run_id> [today_iso] [synthesis]");
  process.exit(2);
}
const today = process.argv[4] ?? new Date().toISOString();
const synthesis = process.argv[5];

// Collect every run's manifest for THIS persona: .generate-ads-img/runs/*/ad-creatives/{persona}/ad-creative.json
const runsDir = statePath("runs");
const snapshots: any[] = [];
const sources: string[] = [];
if (existsSync(runsDir)) {
  for (const runId of readdirSync(runsDir)) {
    const rel = `runs/${runId}/ad-creatives/${personaId}/ad-creative.json`;
    if (existsSync(statePath(rel))) {
      try { snapshots.push(loadState<any>(rel)); sources.push(rel); }
      catch (e: any) { console.error(`skip unreadable snapshot ${rel}: ${e?.message}`); }
    }
  }
}

if (!snapshots.length) {
  console.error(`No collection snapshots found for persona '${personaId}' under ${STATE_DIR}/runs/*/ad-creatives/${personaId}/ad-creative.json`);
  console.error("Run a collection first (data-collection mode). competitive-report has nothing to aggregate.");
  process.exit(1);
}

const trend: any = { ...aggregateTrend({ snapshots, today }), generated_at: new Date().toISOString() };
if (synthesis) trend.synthesis = synthesis;

const outPath = `runs/${outRunId}/competitive-trend.json`;
writeState(outPath, trend);
const ok = report("competitive-trend written", validateAgainst("competitive-trend.schema.json", trend));
console.log(`  → ${STATE_DIR}/${outPath}`);
console.log(`  snapshots=${trend.snapshot_count} tracked_ads=${trend.tracked_ads} longevity_top=${trend.longevity_top_k[0]?.library_id ?? "n/a"}(${trend.longevity_top_k[0]?.running_days ?? "?"}d)`);
for (const f of trend.coverage_flags) console.log(`  flag: ${f}`);
process.exit(ok ? 0 : 1);
