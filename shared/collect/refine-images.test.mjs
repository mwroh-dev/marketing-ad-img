import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { keepAdCreatives, typeDistribution, toAdCreativeJson } from "./refine-images.mjs";

const cls = [
  { image_ref: "a.jpg", type: "ad_creative", confidence: 0.9, reason: "헤드라인+효익", competitor_id: "c1" },
  { image_ref: "b.jpg", type: "spec", confidence: 0.95, reason: "스펙표", competitor_id: "c1" },
  { image_ref: "c.jpg", type: "ad_creative", confidence: 0.5, reason: "약한 카피", competitor_id: "c1" },
  { image_ref: "d.jpg", type: "ad_creative", confidence: 0.8, reason: "후킹", competitor_id: "c2" },
  { image_ref: "e.jpg", type: "review", confidence: 0.9, reason: "별점", competitor_id: "c2" },
];

test("keepAdCreatives keeps only ad_creative >= minConfidence, sorted desc, capped", () => {
  const kept = keepAdCreatives(cls, { minConfidence: 0.6, cap: 24 });
  assert.deepEqual(kept.map((k) => k.image_ref), ["a.jpg", "d.jpg"]); // c.jpg(0.5) dropped, spec/review excluded
  const capped = keepAdCreatives(cls, { minConfidence: 0.6, cap: 1 });
  assert.deepEqual(capped.map((k) => k.image_ref), ["a.jpg"]);
});

test("keepAdCreatives breaks confidence ties by input order", () => {
  const tied = [
    { image_ref: "first.jpg", type: "ad_creative", confidence: 0.8, competitor_id: "c1" },
    { image_ref: "second.jpg", type: "ad_creative", confidence: 0.8, competitor_id: "c1" },
  ];
  assert.deepEqual(keepAdCreatives(tied, {}).map((k) => k.image_ref), ["first.jpg", "second.jpg"]);
});

test("typeDistribution counts every type", () => {
  assert.deepEqual(typeDistribution(cls), { ad_creative: 3, spec: 1, review: 1 });
});

test("toAdCreativeJson emits knowledge/guidelines/ad-source-adapter-contract own_detail_cut shape with provenance", () => {
  const kept = keepAdCreatives(cls, {});
  const r = toAdCreativeJson({ personaId: "p1", kept });
  assert.equal(r.persona_id, "p1");
  assert.equal(r.source, "own_detail_cut");
  assert.equal(r.search.country, "KR");
  assert.equal(r.creatives.length, 2);
  assert.deepEqual(r.creatives[0], { image_url: "a.jpg", image_file: "images/ad-0.jpg", subtype: "single_image", type: "ad_creative", confidence: 0.9, competitor_id: "c1" });
});

test("toAdCreativeJson output VALIDATES against the canonical ad-creative.schema.json", () => {
  const schema = JSON.parse(readFileSync(new URL("../../schemas/collection/ad-creative.schema.json", import.meta.url), "utf8"));
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  const r = toAdCreativeJson({ personaId: "p1", kept: keepAdCreatives(cls, {}) });
  assert.ok(validate(r), JSON.stringify(validate.errors));
});
