import test from "node:test";
import assert from "node:assert/strict";
import { medianColor, findCutRows } from "./slice-long-image.mjs";

// Build a tall RGB buffer (channels=3): white background, content occupies middle columns
// (margins x=0 and x=width-1 stay white), with full-white separator bands at given row ranges.
function buildTall(width, height, bands) {
  const ch = 3;
  const data = Buffer.alloc(width * height * ch, 255); // all white
  const isBand = (y) => bands.some(([a, b]) => y >= a && y < b);
  for (let y = 0; y < height; y++) {
    if (isBand(y)) continue; // band rows stay fully white
    for (let x = 1; x < width - 1; x++) { // content in middle cols → red; margins stay white
      const i = (y * width + x) * ch; data[i] = 200; data[i + 1] = 0; data[i + 2] = 0;
    }
  }
  return { data, width, height, channels: ch };
}

const OPTS = { tallRatio: 3, colorTol: 10, rowUniformThreshold: 0.9, minGapPx: 8, minSectionPx: 20, stride: 1 };

test("medianColor returns per-channel median of samples", () => {
  // 3 pixels: white, white, red → median white
  assert.deepEqual(medianColor([255,255,255, 255,255,255, 200,0,0], 3), [255, 255, 255]);
});

test("findCutRows splits a tall image at white separator bands (midpoints), 3 sections", () => {
  const img = buildTall(4, 150, [[30, 40], [70, 80]]); // bands 30-39, 70-79
  const r = findCutRows(img, OPTS);
  assert.deepEqual(r.bgColor, [255, 255, 255]);
  assert.deepEqual(r.cutYs, [35, 75]);               // band midpoints
  assert.deepEqual(r.sections, [{ y0: 0, y1: 35 }, { y0: 35, y1: 75 }, { y0: 75, y1: 150 }]);
});

test("findCutRows passes through a non-tall image whole (no cuts)", () => {
  const img = buildTall(100, 100, []); // ratio 1 < tallRatio
  const r = findCutRows(img, OPTS);
  assert.deepEqual(r.cutYs, []);
  assert.deepEqual(r.sections, [{ y0: 0, y1: 100 }]);
});

test("findCutRows ignores a thin band below minGapPx", () => {
  const img = buildTall(4, 150, [[70, 74]]); // 4px band < minGapPx(8)
  assert.deepEqual(findCutRows(img, OPTS).cutYs, []);
});

test("findCutRows does NOT false-cut a flat near-uniform tall image (content≈bg, no real separator)", () => {
  const w = 4, h = 150, ch = 3;
  const data = Buffer.alloc(w * h * ch);
  for (let i = 0; i < data.length; i += ch) { data[i] = 150; data[i + 1] = 90; data[i + 2] = 60; } // uniform brown
  const r = findCutRows({ data, width: w, height: h, channels: ch }, OPTS);
  assert.deepEqual(r.cutYs, []); // whole image is "separator" → run touches edges → not an internal band
  assert.deepEqual(r.sections, [{ y0: 0, y1: 150 }]);
});

test("findCutRows drops a cut that would make a too-short final section", () => {
  const img = buildTall(4, 150, [[140, 148]]); // band near bottom → final section <minSectionPx(20)
  assert.deepEqual(findCutRows(img, OPTS).cutYs, []);
});
