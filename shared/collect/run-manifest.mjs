// Per-run progress ledger (runs/{run_id}/run.json). Pure ESM + raw fs — mirrors the .mjs collection
// convention (ad-collect-harness.mjs), so run-flow.mjs can import it under plain `node` without a TS loader.
// Shape contract: schemas/collection/run-manifest.schema.json (validate via shared/validators/validate-run-manifest.ts).
//
// WHY: the old runId default was the static string "adlib" — a second collection with no explicit run id
// silently OVERWROTE the first. A dated id + a stage ledger turns runs into resumable, non-clobbering
// snapshots: a returning user can see exactly how far each run got (collected → human_reviewed → screened
// → analyzed). Stage advance is monotonic — you cannot walk a run backwards.
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { safeName } from "./ad-source-helpers.mjs";

export const STAGES = ["collected", "human_reviewed", "screened", "analyzed"];

const runDir = (runId) => `.generate-ads-img/runs/${safeName(runId, "runId")}`;
const manifestPath = (runId) => `${runDir(runId)}/run.json`;

// LOCAL wall-clock timestamp "YYYY-MM-DDTHH:MM" — the run id is a human-facing label, so it should read
// as the collection's LOCAL date (a 1am KST run is today, not yesterday-UTC). Machine timestamps elsewhere
// (created_at) stay UTC ISO.
function localStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Short, READABLE, collision-resistant run id, e.g. "2026-06-23-1430-meta-keyword". `now` is injected
// (an ISO-ish "YYYY-MM-DDTHH:MM…" string) so the id is deterministic and unit-testable; the default is the
// local wall clock. Date+HHMM keeps distinct runs (different day/minute/source/mode) from clobbering.
export function datedRunId(source, mode, now = localStamp()) {
  const iso = String(now);
  const date = iso.slice(0, 10);                       // YYYY-MM-DD
  const hm = iso.slice(11, 16).replace(":", "");       // HHMM
  const srcShort = String(source || "src").split("_")[0] || "src";
  const modeShort = String(mode || "run");
  const id = `${date}-${hm}-${srcShort}-${modeShort}`;
  return safeName(id, "runId");
}

export function readManifest(runId) {
  const p = manifestPath(runId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

export function writeRunManifest(runId, data) {
  mkdirSync(runDir(runId), { recursive: true });
  writeFileSync(manifestPath(runId), JSON.stringify(data, null, 2) + "\n", "utf8");
  return data;
}

// Build the initial manifest at the `collected` stage (called right after a collection run).
export function buildCollectedManifest({ runId, source, track, personaId, productId = null, queries = [], collected = 0, now = new Date().toISOString() }) {
  return {
    run_id: runId,
    created_at: now,
    source,
    track,
    persona_id: personaId,
    product_id: productId,
    queries: queries.map((q) => ({ query: q.query, mode: q.mode, axis: q.axis ?? null, results_count: q.results_count ?? null })),
    stage: "collected",
    counts: { collected, kept_by_human: null, screened: null, analyzed: null },
    stage_history: [{ stage: "collected", at: now }],
  };
}

// Advance a run's stage MONOTONICALLY. Going backward throws; re-stating the current stage is a no-op
// (idempotent) but still merges any countsPatch. countsPatch e.g. { kept_by_human: 18 }.
export function advanceStage(runId, stage, countsPatch = {}, now = new Date().toISOString()) {
  if (!STAGES.includes(stage)) throw new Error(`unknown stage '${stage}' (expected one of ${STAGES.join(", ")})`);
  const m = readManifest(runId);
  if (!m) throw new Error(`no run manifest at ${manifestPath(runId)} — collect first`);
  const fromIdx = STAGES.indexOf(m.stage);
  const toIdx = STAGES.indexOf(stage);
  if (toIdx < fromIdx) throw new Error(`stage cannot go backward: ${m.stage} → ${stage}`);
  m.counts = { ...m.counts, ...countsPatch };
  if (toIdx > fromIdx) {
    m.stage = stage;
    m.stage_history = [...(m.stage_history || []), { stage, at: now }];
  }
  return writeRunManifest(runId, m);
}
