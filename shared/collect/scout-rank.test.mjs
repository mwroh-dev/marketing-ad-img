import test from "node:test";
import assert from "node:assert/strict";
import { deriveQueries, normalizeTitle, dedupeCandidates, scorePersonaFit, rankCandidates } from "./scout-rank.mjs";

test("deriveQueries includes category + seeds + cues, deduped, trimmed", () => {
  const q = deriveQueries({ productCategory: "category_x", languageCues: ["cue1", "cue2", "cue1"], seeds: [" seed1 ", "cue1"] });
  assert.ok(q.includes("category_x"));
  assert.ok(q.includes("seed1"));        // trimmed
  assert.equal(q.filter((x) => x === "cue1").length, 1); // deduped across sources
});

test("normalizeTitle strips case/space/punct", () => {
  assert.equal(normalizeTitle(" A  B-C! "), "abc");
});

test("dedupeCandidates removes same normalized name, keeps first", () => {
  const out = dedupeCandidates([
    { name: "BrandX item_a", source_surface: "meta_ad_library" },
    { name: "BrandX  item_a", source_surface: "meta_ad_library" },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].source_surface, "meta_ad_library");
});

test("scorePersonaFit counts language_cue hits in name+snippet", () => {
  const persona = { language_cues: ["cue1", "cue2", "cue3"] };
  const s = scorePersonaFit({ name: "cue1 BrandX item", snippet: "cue2 추천" }, persona);
  assert.equal(s, 2);
});

test("rankCandidates orders by score desc, stable", () => {
  const persona = { language_cues: ["cue1", "cue2"] };
  const ranked = rankCandidates([
    { name: "BrandZ", snippet: "" },
    { name: "cue1 cue2 BrandX", snippet: "" },
    { name: "cue1 BrandY", snippet: "" },
  ], persona);
  assert.equal(ranked[0].name, "cue1 cue2 BrandX");
  assert.equal(ranked[2].name, "BrandZ");
});

test("deriveQueries uses keyword-model group tops when provided", () => {
  const model = { groups: [
    { slot: "product_category", keywords: [{ canonical: "kw1" }, { canonical: "kw2" }] },
    { slot: "feature", keywords: [{ canonical: "kw3" }] },
    { slot: "target", keywords: [{ canonical: "kw4" }] },
  ]};
  const q = deriveQueries({ productCategory: "category_x", languageCues: [], seeds: [] }, model);
  assert.ok(q.some((x) => x.includes("kw1") && x.includes("kw3")));   // product×feature combo
  assert.ok(q.length <= 8);                                                // bounded
});
