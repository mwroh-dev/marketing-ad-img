import test from "node:test";
import assert from "node:assert/strict";
import { defineFlow } from "./define-flow.mjs";

test("defineFlow injects safe defaults", () => {
  const f = defineFlow({ name: "x", entrypoints: ["https://x.test/"], collect: async () => {} });
  assert.equal(f.source, "x");
  assert.deepEqual(f.acceptModes, ["keyword", "advertiser"]);
  assert.equal(f.isEnabled(), true);
  assert.equal(f.imgMatch("anything"), false);
  assert.deepEqual(f.config, {});
  assert.ok(Object.isFrozen(f));
});
test("defineFlow keeps explicit fields over defaults", () => {
  const f = defineFlow({ name: "m", source: "meta_ad_library", entrypoints: ["https://f.test/"], acceptModes: ["keyword"], imgMatch: () => true, collect: async () => {} });
  assert.equal(f.source, "meta_ad_library");
  assert.deepEqual(f.acceptModes, ["keyword"]);
  assert.equal(f.imgMatch("x"), true);
});
test("defineFlow rejects missing required fields", () => {
  assert.throws(() => defineFlow({ entrypoints: ["https://x/"], collect: async () => {} }), /name/);
  assert.throws(() => defineFlow({ name: "x", collect: async () => {} }), /entrypoints/);
  assert.throws(() => defineFlow({ name: "x", entrypoints: ["https://x/"] }), /collect/);
});
