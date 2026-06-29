import test from "node:test";
import assert from "node:assert/strict";
import { compareCreativeSnapshots } from "./creative-diff.mjs";
import { validateAgainst } from "./schema-validate.mjs";

const ad = (library_id, classified, confidence = {}) => ({
  ad_key: library_id,
  library_id,
  image_ref: `runs/r/ad-creatives/p/images/${library_id}.jpg`,
  identity_coverage: "trackable",
  static_recipe: {
    observed: { text_hash: `txt-${library_id}`, text_element_count: 1, graphic_element_count: 1 },
    classified,
    confidence,
    provenance_refs: [],
  },
});

const snapshot = (id, ads) => ({
  snapshot_id: id,
  run_id: id,
  persona_id: "p",
  captured_at: id === "a" ? "2026-06-01" : "2026-06-08",
  ads,
  aggregate: { axes: {} },
  coverage_flags: [],
});

test("compareCreativeSnapshots computes create/delete/persisted/update and distribution deltas", () => {
  const from = snapshot("a", [
    ad("L1", { appeal: "price", funnel_stage: "conversion", visual_register: "clean_minimal" }),
    ad("L2", { appeal: "price", funnel_stage: "conversion", visual_register: "clean_minimal" }),
  ]);
  const to = snapshot("b", [
    ad("L1", { appeal: "quality_proof", funnel_stage: "consideration", visual_register: "raw_authentic" }),
    ad("L3", { appeal: "quality_proof", funnel_stage: "consideration", visual_register: "raw_authentic" }),
  ]);

  const diff = compareCreativeSnapshots(from, to);

  assert.deepEqual(diff.inventory_delta.created.map((x) => x.library_id), ["L3"]);
  assert.deepEqual(diff.inventory_delta.deleted.map((x) => x.library_id), ["L2"]);
  assert.deepEqual(diff.inventory_delta.persisted.map((x) => x.library_id), ["L1"]);
  assert.deepEqual(diff.update_delta.same_library_id_changed_recipe[0].changed_axes.sort(), ["appeal", "funnel_stage", "visual_register"]);
  assert.equal(diff.distribution_delta.appeal.values.price.delta, -1);
  assert.equal(diff.distribution_delta.appeal.values.quality_proof.delta, 1);
  const validation = validateAgainst("creative-diff.schema.json", diff);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});

test("compareCreativeSnapshots carries low confidence into distribution deltas", () => {
  const from = snapshot("a", [ad("L1", { appeal: "price" }, { intent: "low" })]);
  const to = snapshot("b", [ad("L1", { appeal: "quality_proof" })]);
  const diff = compareCreativeSnapshots(from, to);
  assert.equal(diff.distribution_delta.appeal.confidence_floor, "low");
  const validation = validateAgainst("creative-diff.schema.json", diff);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});

test("compareCreativeSnapshots flags fully untrackable inventory without create/delete claims", () => {
  const from = snapshot("a", [{ ...ad("local-a", { appeal: "price" }), library_id: undefined, identity_coverage: "local_only" }]);
  const to = snapshot("b", [{ ...ad("local-b", { appeal: "price" }), library_id: undefined, identity_coverage: "local_only" }]);
  const diff = compareCreativeSnapshots(from, to);

  assert.equal(diff.inventory_delta.created.length, 0);
  assert.equal(diff.inventory_delta.deleted.length, 0);
  assert.equal(diff.inventory_delta.persisted.length, 0);
  assert.ok(diff.coverage_flags.some((f) => /all ads lack library_id/.test(f)));
});
