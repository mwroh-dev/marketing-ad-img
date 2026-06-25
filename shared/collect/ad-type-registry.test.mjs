import test from "node:test";
import assert from "node:assert/strict";
import { getAllAdTypes, getAdType, getEnabledAdTypes } from "./ad-type-registry.mjs";

test("registry holds the seed adapters", () => {
  const names = getAllAdTypes().map((a) => a.name).sort();
  assert.deepEqual(names, ["default", "informational", "social_proof", "transformational"]);
});

test("getAdType dispatches by name; unknown throws with the registered list", () => {
  assert.equal(getAdType("social_proof").name, "social_proof");
  assert.throws(() => getAdType("nope"), /unknown ad_type: 'nope' \(registered: /);
});

test("every registered adapter carries provenance (grounds_in)", () => {
  for (const a of getAllAdTypes()) {
    assert.ok(a.grounds_in && a.grounds_in.length > 0, `${a.name} must cite grounds_in`);
  }
});

test("getEnabledAdTypes returns enabled adapters", () => {
  assert.equal(getEnabledAdTypes().length, getAllAdTypes().length);
});
