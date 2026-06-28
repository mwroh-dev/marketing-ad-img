// Pure, deterministic text↔graphic binding (axis 6 — the FACT half). No LLM, no network, no pixels.
//
// perception records text_elements and graphic_elements each with a bbox, but NOT which text sits ON which
// graphic — that relation is where an ad's force lives (a "20% off" tag ON the product reads differently than
// the same words as a header). This module computes that relation deterministically from geometry: for each
// text box, the graphic it most overlaps (above a threshold) is its binding. The MEANING of a binding (why that
// CTA is on that product) is intent-analyst's job; here we only emit the geometric fact.
//
// `overlap` = fraction of the TEXT box's area that lies inside the graphic box (intersection / text-area) —
// "how much of this text sits on that graphic". Unit-agnostic (works in 0..1 or 0..100; ratio cancels the unit).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function round(n, p = 1e4) { return Math.round(n * p) / p; }

// Fraction of box a's area that intersects box b. boxes are {x,y,w,h} in any single shared unit.
export function overlapFraction(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const areaA = a.w * a.h;
  if (areaA <= 0) return 0;
  return inter / areaA;
}

// Bind each text element to the graphic it most overlaps, when that overlap ≥ threshold.
// Deterministic: text in input order; on an overlap tie the earlier graphic (input order) wins.
// Returns one pair per BOUND text (unbound text — floating on the canvas — yields no pair, which is itself signal).
export function bindOverlaps({ text_elements = [], graphic_elements = [] }, { threshold = 0.3 } = {}) {
  const pairs = [];
  for (const t of text_elements) {
    let best = null;
    for (const g of graphic_elements) {
      const ov = overlapFraction(t.bbox, g.bbox);
      if (ov >= threshold && (best === null || ov > best.overlap)) best = { graphic_id: g.id, overlap: ov };
    }
    if (best) pairs.push({ text_id: t.id, graphic_id: best.graphic_id, overlap: round(best.overlap) });
  }
  return pairs;
}

// Build a bindings artifact from a perception (or stitched) geometry object.
export function buildBindings(perception, opts) {
  return {
    image_ref: perception.image_ref,
    persona_id: perception.persona_id,
    bound_pairs: bindOverlaps(perception, opts),
  };
}

// CLI: node bbox-bind.mjs <perception-or-stitched.json>  → prints the bindings artifact.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const [path] = process.argv.slice(2);
  if (!path) { console.error("Usage: node bbox-bind.mjs <perception.json>"); process.exit(2); }
  const perception = JSON.parse(readFileSync(path, "utf8"));
  console.log(JSON.stringify(buildBindings(perception), null, 2));
}
