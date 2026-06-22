// SHAPE + run-ledger invariants for runs/{run_id}/run.json. Checks schema conformance, then the two
// invariants JSON-schema can't express: (1) stage_history is monotonic and ends at the current stage;
// (2) counts for not-yet-reached stages are null (no fabricated downstream numbers).
// Usage: tsx shared/validators/validate-run-manifest.ts <path>
import { loadJson, validateAgainst, report } from "../_lib.ts";

const STAGES = ["collected", "human_reviewed", "screened", "analyzed"];

const path = process.argv[2];
if (!path) { console.error("Usage: tsx shared/validators/validate-run-manifest.ts <path>"); process.exit(2); }

const data = loadJson<any>(path);
let ok = report("run-manifest", validateAgainst("run-manifest.schema.json", data));

// (1) stage_history monotonic + consistent with current stage
const hist = Array.isArray(data?.stage_history) ? data.stage_history : [];
const idxs = hist.map((h: any) => STAGES.indexOf(h?.stage));
const monotonic = idxs.every((v: number, i: number) => i === 0 || v >= idxs[i - 1]);
if (hist.length && !monotonic) {
  console.error(`FAIL  stage_history not monotonic: ${hist.map((h: any) => h.stage).join(" → ")}`);
  ok = false;
} else if (hist.length && hist[hist.length - 1].stage !== data.stage) {
  console.error(`FAIL  current stage '${data.stage}' != last history entry '${hist[hist.length - 1].stage}'`);
  ok = false;
} else {
  console.log(`PASS  stage ledger (${data?.stage}; history ${hist.map((h: any) => h.stage).join(" → ") || "—"})`);
}

// (2) counts for stages not yet reached must be null
const reached = STAGES.indexOf(data?.stage);
const stageCount: Record<string, string> = { human_reviewed: "kept_by_human", screened: "screened", analyzed: "analyzed" };
let countsOk = true;
for (const [stage, key] of Object.entries(stageCount)) {
  if (STAGES.indexOf(stage) > reached && data?.counts?.[key] != null) {
    console.error(`FAIL  counts.${key} is set (${data.counts[key]}) but stage '${stage}' not reached (current '${data.stage}')`);
    countsOk = false; ok = false;
  }
}
if (countsOk) console.log(`PASS  counts gating (no fabricated downstream numbers)`);

process.exit(ok ? 0 : 1);
