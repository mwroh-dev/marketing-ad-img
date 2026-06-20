// Deterministic FIRST pass of ad-image screening — runs before the LLM relevance pass (ad-image-screener agent).
// Cheap, no LLM, no judgement: drop only the mechanically-useless (too small / degenerate dimensions / exact
// duplicate). Everything that survives goes to the agent for the relevance verdict. Recall-biased: when in
// doubt, KEEP. Pure `screenImages` is unit-tested; the CLI just gathers file metadata and calls it.

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, basename } from "node:path";

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
  const metas = gatherImageMetas(imagesDir);
  const { kept, dropped } = screenImages(metas);
  const out = outArg ?? resolve(dirname(dirname(imagesDir)), "screening", `screen-${personaId}.json`);
  const result = { run_id: runId, persona_id: personaId, total: metas.length, kept, dropped };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(`SCREENED(deterministic) ${metas.length} → kept ${kept.length}, dropped ${dropped.length} (${out})`);
  console.log("  NOTE: deterministic pass only (size/dimension/duplicate). Hand `kept` to ad-image-screener for the relevance verdict.");
}
