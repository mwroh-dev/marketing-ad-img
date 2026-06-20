// Long-image slicer — cut a tall composite detail image into section images at uniform
// background-color bands (separator rows). Pure core (raw-pixel row scan) + guarded sharp CLI.
// Signal A only (precision-first). NO text OCR — mechanical pixel scan.
import { fileURLToPath } from "url";

export function medianColor(samples, channels) {
  const n = Math.floor(samples.length / channels);
  const out = [];
  for (let c = 0; c < 3; c++) {
    const vals = [];
    for (let i = 0; i < n; i++) vals.push(samples[i * channels + (c < channels ? c : channels - 1)]);
    vals.sort((a, b) => a - b);
    out.push(vals.length ? vals[Math.floor((n - 1) / 2)] : 0); // lower-median (conventional tiebreak for even n)
  }
  return out;
}

export function findCutRows({ data, width, height, channels }, opts = {}) {
  const { tallRatio = 3.0, colorTol = 12, rowUniformThreshold = 0.98, minGapPx = 12, minSectionPx = 200, stride = 8 } = opts;
  if (height / width < tallRatio) return { bgColor: null, cutYs: [], sections: [{ y0: 0, y1: height }] };

  // background color = median of left+right margin columns over the full height
  const edge = Math.max(1, stride);
  const margin = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < edge && x < width; x++) { const i = (y * width + x) * channels; for (let c = 0; c < channels; c++) margin.push(data[i + c]); }
    for (let x = Math.max(0, width - edge); x < width; x++) { const i = (y * width + x) * channels; for (let c = 0; c < channels; c++) margin.push(data[i + c]); }
  }
  const bg = medianColor(margin, channels);

  // separator row = fraction of (strided) pixels matching bg within colorTol >= threshold
  const isSep = new Array(height).fill(false);
  for (let y = 0; y < height; y++) {
    let match = 0, total = 0;
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * channels; total++;
      let ok = true;
      for (let c = 0; c < 3 && c < channels; c++) if (Math.abs(data[i + c] - bg[c]) > colorTol) { ok = false; break; }
      if (ok) match++;
    }
    isSep[y] = total > 0 && match / total >= rowUniformThreshold;
  }

  // gaps = runs of separator rows length>=minGapPx, SANDWICHED BY CONTENT → candidate cut at midpoint.
  // A run touching y=0 or y=height is edge padding / a flat (content≈bg) image, NOT an internal
  // separator between two sections — reject it (precision-first: avoid false-cutting flat images).
  const candidates = [];
  let runStart = -1;
  for (let y = 0; y <= height; y++) {
    if (y < height && isSep[y]) { if (runStart < 0) runStart = y; }
    else if (runStart >= 0) { if (y - runStart >= minGapPx && runStart > 0 && y < height) candidates.push(Math.floor((runStart + y) / 2)); runStart = -1; }
  }

  // enforce minSectionPx: accept a cut only if >=minSectionPx from previous accepted cut
  const cutYs = [];
  let prev = 0;
  for (const cut of candidates) if (cut - prev >= minSectionPx) { cutYs.push(cut); prev = cut; }
  // drop trailing cut if the final section would be too short
  if (cutYs.length && height - cutYs[cutYs.length - 1] < minSectionPx) cutYs.pop();

  const sections = [];
  let y0 = 0;
  for (const cut of cutYs) { sections.push({ y0, y1: cut }); y0 = cut; }
  sections.push({ y0, y1: height });
  return { bgColor: bg, cutYs, sections };
}

// --- CLI (runs only when invoked directly, not on import) ---
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const { writeFileSync, mkdirSync, readFileSync } = await import("fs");
  const { dirname, basename, join, extname } = await import("path");
  let sharp;
  try { sharp = (await import("sharp")).default; }
  catch { console.error("optional dependency 'sharp' not installed — run `npm install sharp`"); process.exit(1); }

  const argVal = (f) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : null; };
  const positional = process.argv.slice(2).filter((a, i, arr) => !a.startsWith("--") && arr[i - 1] !== "--out" && arr[i - 1] !== "--from");
  const fromFile = argVal("--from");

  // collect input image paths
  let images;
  if (fromFile) {
    const col = JSON.parse(readFileSync(fromFile, "utf8"));
    images = (col.products || []).flatMap((p) => p.image_files || []);
  } else if (positional[0]) {
    images = [positional[0]];
  } else { console.error("Usage: slice-long-image.mjs <image.jpg> [--out <dir>] | --from <competitors.json>"); process.exit(1); }

  const manifest = { sliced: [], passthrough: [] };
  for (const src of images) {
    try {
      const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
      const { sections, cutYs } = findCutRows({ data, width: info.width, height: info.height, channels: info.channels });
      if (cutYs.length === 0) { manifest.passthrough.push(src); continue; }
      const outDir = argVal("--out") || join(dirname(src), "sliced");
      mkdirSync(outDir, { recursive: true });
      const stem = basename(src, extname(src));
      const out = [];
      for (let s = 0; s < sections.length; s++) {
        const { y0, y1 } = sections[s];
        const file = join(outDir, `${stem}-s${s}.jpg`);
        await sharp(src).extract({ left: 0, top: y0, width: info.width, height: y1 - y0 }).jpeg().toFile(file);
        out.push({ file, y0, y1 });
      }
      manifest.sliced.push({ source: src, sections: out });
    } catch (e) { manifest.passthrough.push(src); console.error(`slice skip ${src}: ${e.message}`); }
  }
  const manifestPath = argVal("--out") ? join(argVal("--out"), "slice-manifest.json") : (fromFile ? join(dirname(fromFile), "slice-manifest.json") : "slice-manifest.json");
  mkdirSync(dirname(manifestPath), { recursive: true }); // ensure parent exists even when all-passthrough (no section dir made)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`SLICED ${manifest.sliced.length} long images (${manifest.sliced.reduce((n, s) => n + s.sections.length, 0)} sections), ${manifest.passthrough.length} passthrough → ${manifestPath}`);
}
