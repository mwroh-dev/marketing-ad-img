// Single deterministic command for the analysis tail — the easy-correct path, so the orchestrator runs ONE thing
// instead of hand-writing the lineage store (which it does inconsistently: raw payloads, partial envelopes,
// missing provenance). Reads the per-kind staging the analysts wrote (runs/{run}/analysis/{kind}/{kind}-{N}.json),
// persists the per-ad lineage store envelopes (provenance-stamped, via persist-analysis-run), and advances the
// run ledger to `analyzed`. If the staging is empty it FAILS LOUDLY — the store is never silently left to
// improvisation. The validate-store gate is the backstop that refuses an improvised store downstream. No LLM.
//
// Run from the consumer cwd (where .generate-ads-img lives — advanceStage is cwd-relative).
// Usage: node shared/harness/close-analysis.mjs <run_id> [stateDir]
import { persistAnalysisRun } from "../lineage/persist-analysis-run.mjs";
import { advanceStage } from "../collect/run-manifest.mjs";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function closeAnalysis({ runId, stateDir, advance = true }) {
  const analysisDir = resolve(stateDir, "runs", runId, "analysis");
  if (!existsSync(analysisDir)) throw new Error(`no analysis staging at ${analysisDir} — the analysts wrote no per-kind output`);
  const persisted = persistAnalysisRun({ analysisDir, stateDir });
  const ads = new Set(persisted.map((p) => p.slot)).size;
  if (advance && persisted.length > 0) advanceStage(runId, "analyzed", { analyzed: ads });
  return { persisted: persisted.length, ads };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [runId, stateDirArg] = process.argv.slice(2);
  if (!runId) { console.error("Usage: node shared/harness/close-analysis.mjs <run_id> [stateDir]"); process.exit(2); }
  const stateDir = resolve(stateDirArg ?? process.env.GEN_ADS_IMG_STATE ?? resolve(process.cwd(), ".generate-ads-img"));
  const { persisted, ads } = closeAnalysis({ runId, stateDir });
  if (persisted === 0) {
    console.error(`close-analysis: 0 envelopes — the per-kind staging runs/${runId}/analysis/{ocr,type,copy,layout,visual,intent,strategy} is empty. The analysts must write their per-image output there; the store is NOT to be hand-written.`);
    process.exit(1);
  }
  console.log(`close-analysis: persisted ${persisted} envelopes across ${ads} ad(s) → store/, run ${runId} → analyzed`);
}
