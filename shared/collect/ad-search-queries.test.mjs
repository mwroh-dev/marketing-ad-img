import test from "node:test";
import assert from "node:assert/strict";
import { buildAdQueries } from "./ad-search-queries.mjs";

const model = { groups: [
  { slot: "product_category", keywords: [{ canonical: "kw1" }, { canonical: "kw2" }] },
  { slot: "feature", keywords: [{ canonical: "kw3" }] },
  { slot: "target", keywords: [{ canonical: "kw4" }] },
]};

test("keyword mode builds product×modifier combos from the keyword model", () => {
  const qs = buildAdQueries({ productCategory: "category_x", keywordModel: model });
  const kw = qs.filter((q) => q.mode === "keyword").map((q) => q.query);
  assert.ok(kw.some((q) => q.includes("kw1") && q.includes("kw3")));
});

test("advertiser mode adds confirmed competitor names", () => {
  const qs = buildAdQueries({ keywordModel: model, competitors: [{ name: "BrandX" }, "BrandY"] });
  const adv = qs.filter((q) => q.mode === "advertiser").map((q) => q.query);
  assert.deepEqual(adv, ["BrandX", "BrandY"]);
});

test("respects max caps and dedups", () => {
  const qs = buildAdQueries({ keywordModel: model, competitors: ["A", "B", "C"], maxKeyword: 2, maxAdvertiser: 2 });
  assert.ok(qs.filter((q) => q.mode === "keyword").length <= 2);
  assert.equal(qs.filter((q) => q.mode === "advertiser").length, 2);
});

test("no model + no competitors → empty", () => {
  assert.deepEqual(buildAdQueries({}), []);
});
