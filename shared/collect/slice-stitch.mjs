// Pure, deterministic slice-coordinate stitch. No LLM, no network, no pixels.
//
// A tall detail-cut is sliced into sections (slice-manifest: each section has pixel y0..y1 of the source).
// perception-extractor observes each section with bboxes RELATIVE TO THAT SECTION's own canvas, and is told
// NOT to stitch across sections. This module is the CODE that recombines: it offsets every section element's
// bbox into ONE global frame for the whole source image, so the binding step (bbox-bind) can find cross-section
// text↔graphic relationships the per-section views could never see.
//
// Scope: COORDINATE recombination only. scene/look are per-section observations and are NOT merged (they have
// no single global value). The output is a unified geometry frame (text + graphic elements in global coords)
// — exactly what axis-6 binding needs.
//
// bbox unit: the perception contract is percent-of-canvas 0..100. `unit` is configurable for safety; the math
// is unit-preserving (global coords come back in the same unit).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function round(n, p = 1e4) { return Math.round(n * p) / p; }

// Remap one section-relative bbox into the global source frame.
// section spans source pixels [y0, y1]; sourceHeight = total source pixel height.
// x/w are unchanged (sections are full-width horizontal slices); y/h are offset+scaled.
export function remapBbox(bbox, { y0, y1, sourceHeight, unit = 100 }) {
  const secH = y1 - y0;
  const yFrac = bbox.y / unit;            // fraction down the SECTION
  const hFrac = bbox.h / unit;
  const gY = (y0 + yFrac * secH) / sourceHeight;   // fraction down the SOURCE
  const gH = (hFrac * secH) / sourceHeight;
  return { x: bbox.x, y: round(gY * unit), w: bbox.w, h: round(gH * unit) };
}

// Stitch all sections of ONE sliced source into a single global-frame geometry object.
//   sliced            { source, sections:[{file,y0,y1}] }  (one slice-manifest entry)
//   perceptionsByFile { [file]: perception }               (the per-section perception artifacts)
// sourceHeight defaults to the max section y1 (sections tile the source top-to-bottom).
export function stitchSections({ sliced, perceptionsByFile, unit = 100 }) {
  const sections = sliced.sections || [];
  const sourceHeight = Math.max(1, ...sections.map((s) => s.y1));
  const text_elements = [];
  const graphic_elements = [];
  let persona_id = null;
  for (const sec of sections) {
    const p = perceptionsByFile[sec.file];
    if (!p) continue;                       // a section with no perception artifact is skipped, not faked
    persona_id = persona_id ?? p.persona_id ?? null;
    const ctx = { y0: sec.y0, y1: sec.y1, sourceHeight, unit };
    for (const t of p.text_elements || [])
      text_elements.push({ ...t, id: `${sec.file}:${t.id ?? ""}`, bbox: remapBbox(t.bbox, ctx) });
    for (const g of p.graphic_elements || [])
      graphic_elements.push({ ...g, id: `${sec.file}:${g.id ?? ""}`, bbox: remapBbox(g.bbox, ctx) });
  }
  return { image_ref: sliced.source, persona_id, text_elements, graphic_elements };
}

// CLI: node slice-stitch.mjs <slice-manifest.json> <section-perception-dir>
// reads each sliced source's section perceptions from <dir>/<sectionFile>.json, prints the stitched frames.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const [manifestPath, dir] = process.argv.slice(2);
  if (!manifestPath || !dir) { console.error("Usage: node slice-stitch.mjs <slice-manifest.json> <section-perception-dir>"); process.exit(2); }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const out = (manifest.sliced || []).map((sliced) => {
    const perceptionsByFile = {};
    for (const sec of sliced.sections || []) {
      try { perceptionsByFile[sec.file] = JSON.parse(readFileSync(`${dir}/${sec.file}.json`, "utf8")); } catch { /* missing section → skipped */ }
    }
    return stitchSections({ sliced, perceptionsByFile });
  });
  console.log(JSON.stringify(out, null, 2));
}
