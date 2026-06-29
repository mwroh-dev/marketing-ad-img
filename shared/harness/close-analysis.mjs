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
import { loadEnvelopes } from "../lineage/read-store.mjs";
import { assertSnapshotJoinCoverage, buildCreativeSnapshot } from "../collect/creative-snapshot.mjs";
import { validateAgainst } from "../collect/schema-validate.mjs";
import { advanceStage, readManifest } from "../collect/run-manifest.mjs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function freezeCreativeSnapshotsForRun({ runId, stateDir, generatedAt = new Date().toISOString() } = {}) {
  const adRoot = resolve(stateDir, "runs", runId, "ad-creatives");
  if (!existsSync(adRoot)) return [];
  const written = [];
  for (const entry of readdirSync(adRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const personaId = entry.name;
    const creativePath = resolve(adRoot, personaId, "ad-creative.json");
    if (!existsSync(creativePath)) continue;
    const creativeSet = loadJson(creativePath);
    const snapshot = buildCreativeSnapshot({
      runId,
      personaId: creativeSet.persona_id || personaId,
      creativeSet,
      envelopes: loadEnvelopes(creativeSet.persona_id || personaId, { stateDir }),
      generatedAt,
    });
    assertSnapshotJoinCoverage(snapshot);
    const validation = validateAgainst("creative-snapshot.schema.json", snapshot);
    if (!validation.ok) throw new Error(`creative-snapshot invalid for ${runId}/${personaId}: ${validation.errors.join("; ")}`);
    const out = resolve(stateDir, "runs", runId, "creative-change", `creative-snapshot.${runId}.json`);
    writeJson(out, snapshot);
    written.push(out);
  }
  return written;
}

export function closeAnalysis({ runId, stateDir, advance = true }) {
  const analysisDir = resolve(stateDir, "runs", runId, "analysis");
  if (!existsSync(analysisDir)) throw new Error(`no analysis staging at ${analysisDir} — the analysts wrote no per-kind output`);
  if (advance && !readManifest(runId)) {
    throw new Error(`no run manifest for ${runId} — collect first; close-analysis will not write store envelopes without a run ledger`);
  }
  const persisted = persistAnalysisRun({ analysisDir, stateDir });
  const ads = new Set(persisted.map((p) => p.slot)).size;
  const snapshots = persisted.length > 0 ? freezeCreativeSnapshotsForRun({ runId, stateDir }) : [];
  if (advance && persisted.length > 0) advanceStage(runId, "analyzed", { analyzed: ads });
  return { persisted: persisted.length, ads, snapshots: snapshots.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [runId, stateDirArg] = process.argv.slice(2);
  if (!runId) { console.error("Usage: node shared/harness/close-analysis.mjs <run_id> [stateDir]"); process.exit(2); }
  const stateDir = resolve(stateDirArg ?? process.env.GEN_ADS_IMG_STATE ?? resolve(process.cwd(), ".generate-ads-img"));
  const { persisted, ads, snapshots } = closeAnalysis({ runId, stateDir });
  if (persisted === 0) {
    console.error(`close-analysis: 0 envelopes — the per-kind staging runs/${runId}/analysis/{ocr,type,copy,layout,visual,intent,strategy} is empty. The analysts must write their per-image output there; the store is NOT to be hand-written.`);
    process.exit(1);
  }
  console.log(`close-analysis: persisted ${persisted} envelopes across ${ads} ad(s), froze ${snapshots} creative snapshot(s) → store/, run ${runId} → analyzed`);
}
