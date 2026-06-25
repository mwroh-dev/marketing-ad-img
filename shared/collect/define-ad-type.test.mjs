import test from "node:test";
import assert from "node:assert/strict";
import { defineAdType } from "./define-ad-type.mjs";

test("defineAdType injects defaults and freezes", () => {
  const a = defineAdType({ name: "informational", grounds_in: "Puto & Wells (1984) informational", emphasizes: ["copy"] });
  assert.deepEqual(a.requires, []);
  assert.deepEqual(a.gates, []);
  assert.equal(typeof a.isEnabled, "function");
  assert.equal(a.isEnabled(), true);
  assert.equal(Object.isFrozen(a), true);
});

test("defineAdType requires name", () => {
  assert.throws(() => defineAdType({ grounds_in: "x", emphasizes: ["copy"] }), /`name` is required/);
});

test("PROVENANCE is mandatory — missing grounds_in throws", () => {
  assert.throws(() => defineAdType({ name: "x", emphasizes: ["copy"] }), /grounds_in.*REQUIRED/);
  assert.throws(() => defineAdType({ name: "x", grounds_in: "", emphasizes: ["copy"] }), /grounds_in.*REQUIRED/);
});

test("defineAdType requires non-empty emphasizes", () => {
  assert.throws(() => defineAdType({ name: "x", grounds_in: "src" }), /`emphasizes`/);
  assert.throws(() => defineAdType({ name: "x", grounds_in: "src", emphasizes: [] }), /`emphasizes`/);
});

test("explicit fields override defaults", () => {
  const a = defineAdType({ name: "social_proof", grounds_in: "Belch & Belch testimonial", emphasizes: ["binding", "intent"], requires: ["screenshot_binding"], gates: ["no_social_device"] });
  assert.deepEqual(a.requires, ["screenshot_binding"]);
  assert.deepEqual(a.gates, ["no_social_device"]);
});
