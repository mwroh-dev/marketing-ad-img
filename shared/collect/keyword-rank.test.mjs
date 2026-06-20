import test from "node:test";
import assert from "node:assert/strict";
import { countOccurrences, computeStats, scoreKeywords, rankByGroup } from "./keyword-rank.mjs";

const corpus = { docs: [
  { competitor_id: "c1", title: "kw2 kw1", detail: "kw2" },
  { competitor_id: "c2", title: "kw3 kw1 LED", detail: "led kw2" },
]};
const instances = [
  { canonical: "kw1", variants: ["alias1"], slot: "product_category" },
  { canonical: "kw2", variants: [], slot: "feature" },
  { canonical: "LED", variants: ["led"], slot: "feature" },
];

test("countOccurrences counts canonical + variants, case-insensitive", () => {
  assert.equal(countOccurrences("kw2 kw1 kw2", "kw2"), 2);
  assert.equal(countOccurrences("Alias1 kw1", "kw1", ["alias1"]), 2);
});

test("computeStats weights title x2 and counts distinct competitors (df)", () => {
  const stats = computeStats(instances, corpus);
  const k1 = stats.find((s) => s.canonical === "kw1");
  assert.equal(k1.tf, 4);   // title hit in c1 + c2 → 2 titles × 2 = 4
  assert.equal(k1.df, 2);   // both competitors
  const led = stats.find((s) => s.canonical === "LED");
  assert.equal(led.tf, 3);     // c2 title "LED" ×2 + c2 detail "led" ×1
  assert.equal(led.df, 1);
});

test("scoreKeywords adds cue bonus when a persona cue matches", () => {
  const stats = computeStats(instances, corpus);
  const scored = scoreKeywords(stats, { language_cues: ["cue1", "kw2"] }, 2);
  const ms = scored.find((s) => s.canonical === "kw2");
  assert.equal(ms.cue_match, 1);
  assert.ok(ms.score > 0);
});

test("rankByGroup groups by slot and returns score-desc top-k, stable", () => {
  const stats = computeStats(instances, corpus);
  const scored = scoreKeywords(stats, { language_cues: [] }, 2);
  const ranked = rankByGroup(scored, 10);
  const feature = ranked.find((g) => g.slot === "feature");
  assert.ok(feature.keywords.length === 2);
  for (let i = 1; i < feature.keywords.length; i++)
    assert.ok(feature.keywords[i].score <= feature.keywords[i - 1].score);
});

test("ranking is deterministic", () => {
  const a = rankByGroup(scoreKeywords(computeStats(instances, corpus), { language_cues: [] }, 2));
  const b = rankByGroup(scoreKeywords(computeStats(instances, corpus), { language_cues: [] }, 2));
  assert.deepEqual(a, b);
});
