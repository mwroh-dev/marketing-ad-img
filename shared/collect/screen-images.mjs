// Deterministic ad-image screen — the ONLY automated keep/drop, and it runs AFTER the human keep/delete
// review (not before, and no LLM). The human already absorbed the quality/relevance judgement (logos, UI,
// off-target) using fast, cheap visual cognition; this pass only normalizes what's left: drop the
// mechanically-useless (too small / degenerate dimensions / exact duplicate). Recall-biased: when in doubt,
// KEEP. Pure `screenImages` is unit-tested; the CLI gathers file metadata, calls it, and advances the run
// stage to `screened`.

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, basename } from "node:path";
import { advanceStage } from "./run-manifest.mjs";

// Pure: metas = [{ image_file, bytes, sha256, width?, height? }] → { kept:[image_file], dropped:[{image_file, reason}] }
// reason ∈ image-screening.schema enum (deterministic subset): broken_or_empty | duplicate
export function screenImages(metas, { minBytes = 2000, minDim = 80 } = {}) {
  const kept = [];
  const dropped = [];
  const seen = new Map(); // sha256 → first image_file
  for (const m of metas) {
    if (!m || !m.image_file) continue;
    if (typeof m.bytes === "number" && m.bytes < minBytes) {
      dropped.push({ image_file: m.image_file, reason: "broken_or_empty" });
      continue;
    }
    if (typeof m.width === "number" && typeof m.height === "number" && (m.width < minDim || m.height < minDim)) {
      dropped.push({ image_file: m.image_file, reason: "broken_or_empty" });
      continue;
    }
    if (m.sha256 && seen.has(m.sha256)) {
      dropped.push({ image_file: m.image_file, reason: "duplicate" });
      continue;
    }
    if (m.sha256) seen.set(m.sha256, m.image_file);
    kept.push(m.image_file);
  }
  return { kept, dropped };
}

// Gather metadata for every image in a dir (file bytes + content hash; dimensions via sharp if available).
export function gatherImageMetas(imagesDir, { relPrefix = "images" } = {}) {
  let entries;
  try { entries = readdirSync(imagesDir).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f)); }
  catch { return []; }
  return entries.map((f) => {
    const abs = resolve(imagesDir, f);
    const buf = readFileSync(abs);
    return {
      image_file: `${relPrefix}/${f}`,
      bytes: statSync(abs).size,
      sha256: createHash("sha256").update(buf).digest("hex"),
    };
  });
}

// CLI: node screen-images.mjs <run_id> <persona_id> <imagesDir> [outPath]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [runId, personaId, imagesDir, outArg] = process.argv.slice(2);
  if (!runId || !personaId || !imagesDir) {
    console.error("Usage: node shared/collect/screen-images.mjs <run_id> <persona_id> <imagesDir> [outPath]");
    process.exit(2);
  }
  // Screening file lives at the RUN level (runs/{run}/screening/screen-{persona}.json) — the SAME file the
  // human keep/delete review wrote. imagesDir = runs/{run}/ad-creatives/{persona}/images → up 3 = runs/{run}.
  const out = outArg ?? resolve(dirname(dirname(dirname(imagesDir))), "screening", `screen-${personaId}.json`);

  // If the human review already wrote this file, screen ONLY its `kept` survivors and MERGE drops, so a
  // human-deleted image is never resurrected by a fresh dir scan. No prior file (e.g. own-detail-cut path)
  // → screen the whole dir.
  let whitelist = null;
  let priorDropped = [];
  if (existsSync(out)) {
    try {
      const prev = JSON.parse(readFileSync(out, "utf8"));
      if (Array.isArray(prev.kept)) whitelist = new Set(prev.kept);
      if (Array.isArray(prev.dropped)) priorDropped = prev.dropped;
    } catch { /* unreadable → treat as a fresh screen */ }
  }

  let metas = gatherImageMetas(imagesDir);
  if (whitelist) metas = metas.filter((m) => whitelist.has(m.image_file));
  const { kept, dropped } = screenImages(metas);
  const mergedDropped = [...priorDropped, ...dropped];               // human drops (user_removed) + deterministic drops
  const result = { run_id: runId, persona_id: personaId, total: kept.length + mergedDropped.length, kept, dropped: mergedDropped };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(`SCREENED(deterministic) ${whitelist ? `${metas.length} human-kept survivors` : `${metas.length} images`} → kept ${kept.length}, +${dropped.length} dropped (total dropped ${mergedDropped.length}) (${out})`);
  console.log("  NOTE: deterministic only (size/dimension/duplicate). Runs AFTER the human keep/delete review — `kept` goes straight to analysis (no LLM screener).");
  // advance the run ledger to `screened`. Best-effort: a manually-pointed imagesDir may not map to a run
  // manifest (e.g. own-detail-cut path), so a missing manifest is a warning, not a failure.
  try { advanceStage(runId, "screened", { screened: kept.length }); }
  catch (e) { console.warn(`  (stage not advanced: ${e.message})`); }
}
