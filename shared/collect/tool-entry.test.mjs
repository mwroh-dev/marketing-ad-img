import test from "node:test";
import assert from "node:assert/strict";
import { matchToolEntry } from "./lib.mjs";

const allowed = ["https://www.facebook.com/ads/library/"];

test("matchToolEntry matches the tool front-door by origin+path, ignoring trailing slash", () => {
  assert.equal(matchToolEntry("https://www.facebook.com/ads/library", allowed), "https://www.facebook.com/ads/library/");
});

test("matchToolEntry ignores query/hash (Meta appends its own params)", () => {
  assert.equal(matchToolEntry("https://www.facebook.com/ads/library/?country=KR&id=5", allowed), "https://www.facebook.com/ads/library/");
});

test("matchToolEntry rejects a different path on the same origin", () => {
  assert.equal(matchToolEntry("https://www.facebook.com/marketplace", allowed), null);
});

test("matchToolEntry rejects a different origin", () => {
  assert.equal(matchToolEntry("https://evil.com/ads/library", allowed), null);
});
