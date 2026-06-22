// CLI: advance a run's stage in its run.json ledger (monotonic — see advanceStage in run-manifest.mjs).
// Usage: node shared/collect/advance-stage.mjs <run_id> <stage> [--kept N] [--screened N] [--analyzed N]
//   stage ∈ collected | human_reviewed | screened | analyzed
import { advanceStage } from "./run-manifest.mjs";
import { fileURLToPath } from "url";

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const argVal = (flag) => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null; };
  const positional = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  const [runId, stage] = positional;
  if (!runId || !stage) {
    console.error("Usage: node shared/collect/advance-stage.mjs <run_id> <stage> [--kept N] [--screened N] [--analyzed N]");
    process.exit(2);
  }
  const countsPatch = {};
  const num = (v) => (v == null ? undefined : Number(v));
  for (const [flag, key] of [["--kept", "kept_by_human"], ["--screened", "screened"], ["--analyzed", "analyzed"]]) {
    const v = num(argVal(flag));
    if (v != null && !Number.isNaN(v)) countsPatch[key] = v;
  }
  try {
    const m = advanceStage(runId, stage, countsPatch);
    console.log(`STAGE ${runId} → ${m.stage}  counts=${JSON.stringify(m.counts)}`);
  } catch (e) {
    console.error(`FAIL  ${e.message}`);
    process.exit(1);
  }
}
