import test from "node:test";
import assert from "node:assert/strict";
import { overlapFraction, bindOverlaps, buildBindings } from "./bbox-bind.mjs";

// VALUE-AGNOSTIC: proves the overlap geometry + binding selection, not any ad content. Abstract t#/g#.

test("overlapFraction = fraction of box a inside box b", () => {
  assert.equal(overlapFraction({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 }), 1); // identical
  assert.equal(overlapFraction({ x: 2, y: 2, w: 4, h: 4 }, { x: 0, y: 0, w: 10, h: 10 }), 1);    // a fully inside b
  assert.equal(overlapFraction({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }), 0.5); // half
  assert.equal(overlapFraction({ x: 0, y: 0, w: 10, h: 10 }, { x: 50, y: 50, w: 10, h: 10 }), 0);  // disjoint
  assert.equal(overlapFraction({ x: 0, y: 0, w: 0, h: 10 }, { x: 0, y: 0, w: 10, h: 10 }), 0);      // zero-area text
});

const graphics = [
  { id: "g1", kind: "k", bbox: { x: 0, y: 0, w: 10, h: 10 } },
  { id: "g2", kind: "k", bbox: { x: 10, y: 0, w: 10, h: 10 } },
];
const texts = [
  { id: "t1", bbox: { x: 0, y: 0, w: 10, h: 10 } },   // fully on g1
  { id: "t2", bbox: { x: 50, y: 50, w: 5, h: 5 } },   // floating — on nothing
  { id: "t3", bbox: { x: 5, y: 0, w: 10, h: 10 } },   // 0.5 on g1 AND 0.5 on g2 → tie
  { id: "t4", bbox: { x: 7, y: 0, w: 10, h: 10 } },   // 0.3 on g1, 0.7 on g2 → best is g2
];

test("bindOverlaps binds each text to its best-overlap graphic above threshold", () => {
  const pairs = bindOverlaps({ text_elements: texts, graphic_elements: graphics });
  assert.equal(pairs.length, 3);                                   // t1, t3, t4 bound; t2 not
  assert.deepEqual(pairs[0], { text_id: "t1", graphic_id: "g1", overlap: 1 });
  assert.equal(pairs[1].graphic_id, "g1");                          // t3 tie → earlier graphic wins
  assert.equal(pairs[2].graphic_id, "g2");                          // t4 → best overlap (0.7) wins
});

test("floating text yields NO pair — absence of a binding is itself signal, never faked", () => {
  const pairs = bindOverlaps({ text_elements: texts, graphic_elements: graphics });
  assert.equal(pairs.find((p) => p.text_id === "t2"), undefined);
});

test("buildBindings carries refs + is deterministic", () => {
  const perception = { image_ref: "img", persona_id: "p", text_elements: texts, graphic_elements: graphics };
  const a = buildBindings(perception);
  const b = buildBindings(perception);
  assert.deepEqual(a, b);
  assert.equal(a.image_ref, "img");
  assert.equal(a.persona_id, "p");
});
