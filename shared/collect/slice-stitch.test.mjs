import test from "node:test";
import assert from "node:assert/strict";
import { remapBbox, stitchSections } from "./slice-stitch.mjs";

// VALUE-AGNOSTIC: these prove the coordinate MATH + merge logic, not any ad content. Abstract elements (t1,g1).

test("remapBbox offsets a section-relative bbox into the global source frame", () => {
  // source 200px tall, two equal sections.
  // section 1 [0..100]: a box at section-mid (y=50,h=20, unit=100) → global y=25, h=10.
  assert.deepEqual(remapBbox({ x: 10, y: 50, w: 30, h: 20 }, { y0: 0, y1: 100, sourceHeight: 200 }),
    { x: 10, y: 25, w: 30, h: 10 });
  // section 2 [100..200]: the SAME section-mid box now lands at global y=75 (offset by the section's position).
  assert.deepEqual(remapBbox({ x: 10, y: 50, w: 30, h: 20 }, { y0: 100, y1: 200, sourceHeight: 200 }),
    { x: 10, y: 75, w: 30, h: 10 });
});

test("stitchSections merges sections, remaps bboxes, prefixes ids, carries persona", () => {
  const sliced = { source: "src.jpg", sections: [
    { file: "sec0", y0: 0, y1: 100 },
    { file: "sec1", y0: 100, y1: 200 },
  ] };
  const perceptionsByFile = {
    sec0: { persona_id: "pX", text_elements: [{ id: "t1", content: "A", bbox: { x: 0, y: 0, w: 50, h: 20 } }], graphic_elements: [] },
    sec1: { persona_id: "pX", text_elements: [], graphic_elements: [{ id: "g1", kind: "product", bbox: { x: 0, y: 0, w: 100, h: 100 } }] },
  };
  const out = stitchSections({ sliced, perceptionsByFile });
  assert.equal(out.image_ref, "src.jpg");
  assert.equal(out.persona_id, "pX");
  // sec0 text at top of section1 → global top.
  assert.deepEqual(out.text_elements[0].bbox, { x: 0, y: 0, w: 50, h: 10 });
  assert.equal(out.text_elements[0].id, "sec0:t1");
  // sec1 graphic filling its section → global lower half (y 50..100).
  assert.deepEqual(out.graphic_elements[0].bbox, { x: 0, y: 50, w: 100, h: 50 });
  assert.equal(out.graphic_elements[0].id, "sec1:g1");
});

test("a section with no perception artifact is SKIPPED, never faked", () => {
  const sliced = { source: "src.jpg", sections: [
    { file: "sec0", y0: 0, y1: 100 },
    { file: "missing", y0: 100, y1: 200 },
  ] };
  const out = stitchSections({ sliced, perceptionsByFile: { sec0: { persona_id: "pX", text_elements: [{ id: "t1", bbox: { x: 0, y: 0, w: 10, h: 10 } }] } } });
  // only sec0's element survives; the missing section contributes nothing (no invented element).
  assert.equal(out.text_elements.length, 1);
  assert.equal(out.graphic_elements.length, 0);
});

test("stitchSections is deterministic", () => {
  const sliced = { source: "s", sections: [{ file: "f", y0: 0, y1: 100 }] };
  const pbf = { f: { persona_id: "p", text_elements: [{ id: "t1", bbox: { x: 1, y: 2, w: 3, h: 4 } }], graphic_elements: [] } };
  assert.deepEqual(stitchSections({ sliced, perceptionsByFile: pbf }), stitchSections({ sliced, perceptionsByFile: pbf }));
});
