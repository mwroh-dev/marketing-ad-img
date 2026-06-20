import test from "node:test";
import assert from "node:assert/strict";
import { parseAdvertiserId, filterQueriesByModes, dedupKey, chooseAdvertiser, safeName } from "./ad-source-helpers.mjs";

test("safeName accepts a plain segment, rejects traversal/separators", () => {
  assert.equal(safeName("buyer", "personaId"), "buyer");
  assert.equal(safeName("run-2026-06-21", "runId"), "run-2026-06-21");
  for (const bad of ["../../tmp/evil", "a/b", "a\\b", "..", ".", "", "x\0y", null, undefined, 7]) {
    assert.throws(() => safeName(bad, "id"), /must be a simple name/);
  }
});

test("parseAdvertiserId extracts AR id from advertiser href, ignores query", () => {
  assert.equal(parseAdvertiserId("/advertiser/AR17828074650563772417?region=KR"), "AR17828074650563772417");
  assert.equal(parseAdvertiserId("https://adstransparency.google.com/advertiser/AR123"), "AR123");
  assert.equal(parseAdvertiserId("/region=KR"), null);
  assert.equal(parseAdvertiserId(""), null);
});

test("filterQueriesByModes keeps only accepted modes", () => {
  const qs = [{ mode: "keyword", query: "kw1" }, { mode: "advertiser", query: "BrandX" }];
  assert.deepEqual(filterQueriesByModes(qs, ["advertiser"]), [{ mode: "advertiser", query: "BrandX" }]);
  assert.deepEqual(filterQueriesByModes(qs, ["keyword", "advertiser"]), qs);
});

test("dedupKey strips query string", () => {
  assert.equal(dedupKey("https://h/img.jpg?a=1&b=2"), "https://h/img.jpg");
  assert.equal(dedupKey("https://h/img.jpg"), "https://h/img.jpg");
});

test("chooseAdvertiser prefers exact, then prefix, over substring (BrandY ≠ XBrandY)", () => {
  const sugg = [
    { text: "XBrandY\n인증\n미국\n광고 약 17개", x: 1, y: 1 },
    { text: "BrandY\n인증\n대한민국\n광고 약 6개", x: 2, y: 2 },
  ];
  const pick = chooseAdvertiser(sugg, "BrandY");
  assert.equal(pick.index, 1);              // the exact "BrandY", NOT first-listed XBrandY
  assert.equal(pick.quality, "exact");
});

test("chooseAdvertiser returns loose when only a substring match exists", () => {
  const sugg = [{ text: "XBrandY\n인증", x: 1, y: 1 }];
  const pick = chooseAdvertiser(sugg, "BrandY");
  assert.equal(pick.index, 0);
  assert.equal(pick.quality, "loose");      // caller can flag this as low-confidence
});

test("chooseAdvertiser returns null when no name relates", () => {
  assert.equal(chooseAdvertiser([{ text: "BrandZ\n인증" }], "BrandY"), null);
  assert.equal(chooseAdvertiser([], "BrandY"), null);
  assert.equal(chooseAdvertiser(null, "BrandY"), null);
});

test("chooseAdvertiser matches advertiser name ignoring spaces/case", () => {
  const pick = chooseAdvertiser([{ text: "BrandX SKY\n인증", x: 5, y: 5 }], "BrandXSKY");
  assert.equal(pick.quality, "exact");
});
