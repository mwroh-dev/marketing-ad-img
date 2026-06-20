import test from "node:test";
import assert from "node:assert/strict";
import { getFlow, getAllFlows, getEnabledFlows } from "./flow-registry.mjs";

test("registry resolves registered flows by name", () => {
  assert.deepEqual(getAllFlows().map((f) => f.name).sort(), ["google", "meta"]);
  assert.equal(getFlow("meta").source, "meta_ad_library");
  assert.equal(getFlow("google").source, "google_ads_transparency");
});
test("getFlow throws on unknown name", () => { assert.throws(() => getFlow("nope"), /unknown flow/); });
test("getEnabledFlows returns https-front-door flows", () => { assert.equal(getEnabledFlows().length, 2); });
