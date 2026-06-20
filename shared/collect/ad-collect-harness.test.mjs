import test from "node:test";
import assert from "node:assert/strict";
import { makeResult } from "./ad-collect-harness.mjs";

test("makeResult builds the analysis-ready schema shell", () => {
  const r = makeResult({ personaId: "p1", source: "google_ads_transparency", queries: [{ mode: "advertiser", query: "BrandX" }], mode: "advertiser" });
  assert.equal(r.persona_id, "p1");
  assert.equal(r.source, "google_ads_transparency");
  assert.equal(r.search.country, "KR");
  assert.equal(r.search.mode, "advertiser");
  assert.equal(r.search.query, "BrandX");
  assert.deepEqual(r.creatives, []);
  assert.deepEqual(r.coverage_flags, []);
  assert.equal(r.blocked, false);
});

test("makeResult joins multiple query strings and tolerates empty", () => {
  const r = makeResult({ personaId: "p", source: "s", queries: [{ mode: "advertiser", query: "a" }, { mode: "advertiser", query: "b" }], mode: "advertiser" });
  assert.equal(r.search.query, "a, b");
  const e = makeResult({ personaId: "p", source: "s", queries: [], mode: "keyword" });
  assert.equal(e.search.query, "");
});
