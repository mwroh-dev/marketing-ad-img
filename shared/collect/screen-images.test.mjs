import test from "node:test";
import assert from "node:assert/strict";
import { screenImages } from "./screen-images.mjs";

test("keeps normal images, drops too-small as broken_or_empty", () => {
  const { kept, dropped } = screenImages([
    { image_file: "images/ad-0.jpg", bytes: 40000, sha256: "a" },
    { image_file: "images/ad-1.jpg", bytes: 500, sha256: "b" },
  ]);
  assert.deepEqual(kept, ["images/ad-0.jpg"]);
  assert.deepEqual(dropped, [{ image_file: "images/ad-1.jpg", reason: "broken_or_empty" }]);
});

test("drops exact duplicate by sha256, keeps the first", () => {
  const { kept, dropped } = screenImages([
    { image_file: "images/ad-0.jpg", bytes: 40000, sha256: "same" },
    { image_file: "images/ad-1.jpg", bytes: 40000, sha256: "same" },
  ]);
  assert.deepEqual(kept, ["images/ad-0.jpg"]);
  assert.deepEqual(dropped, [{ image_file: "images/ad-1.jpg", reason: "duplicate" }]);
});

test("drops degenerate dimensions", () => {
  const { dropped } = screenImages([{ image_file: "images/ad-0.jpg", bytes: 40000, sha256: "a", width: 10, height: 600 }]);
  assert.equal(dropped[0].reason, "broken_or_empty");
});

test("recall-biased: no dims/no dup → kept", () => {
  const { kept } = screenImages([{ image_file: "images/ad-0.jpg", bytes: 40000, sha256: "a" }]);
  assert.deepEqual(kept, ["images/ad-0.jpg"]);
});

test("total accounting: every input in exactly one of kept/dropped", () => {
  const metas = [
    { image_file: "images/ad-0.jpg", bytes: 40000, sha256: "a" },
    { image_file: "images/ad-1.jpg", bytes: 100, sha256: "b" },
    { image_file: "images/ad-2.jpg", bytes: 40000, sha256: "a" },
  ];
  const { kept, dropped } = screenImages(metas);
  assert.equal(kept.length + dropped.length, metas.length);
});
