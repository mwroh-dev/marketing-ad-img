// Per-run progress ledger (runs/{run_id}/run.json). Pure ESM/raw-fs so run-flow.mjs imports it under plain
// `node`. Shape: schemas/collection/run-manifest.schema.json. The dated run id replaces the old static
// "adlib" default that silently overwrote prior runs; stage advance is monotonic and resumable.
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { safeName } from "./ad-source-helpers.mjs";

export const STAGES = ["collected", "human_reviewed", "screened", "analyzed"];

const runDir = (runId) => `.generate-ads-img/runs/${safeName(runId, "runId")}`;
const manifestPath = (runId) => `${runDir(runId)}/run.json`;

// Local wall-clock "YYYY-MM-DDTHH:MM" — the run id reads as the collection's local date (created_at stays UTC).
function localStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Readable, collision-resistant run id, e.g. "2026-06-23-1430-meta-keyword". `now` injected for deterministic tests.
export function datedRunId(source, mode, now = localStamp()) {
  const iso = String(now);
  const date = iso.slice(0, 10);
  const hm = iso.slice(11, 16).replace(":", "");
  const srcShort = String(source || "src").split("_")[0] || "src";
  const modeShort = String(mode || "run");
  return safeName(`${date}-${hm}-${srcShort}-${modeShort}`, "runId");
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

// Advance stage monotonically (backward throws); same-stage is a no-op that still merges countsPatch.
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
