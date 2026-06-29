import test from "node:test";
import assert from "node:assert/strict";
import { detectChangeCandidates } from "./change-candidates.mjs";
import { validateAgainst } from "./schema-validate.mjs";

test("detectChangeCandidates promotes material computed distribution shifts", () => {
  const candidates = detectChangeCandidates({
    from_snapshot_id: "a",
    to_snapshot_id: "b",
    inventory_delta: { created: [], deleted: [], persisted: [], untrackable: [] },
    update_delta: { same_library_id_changed_recipe: [] },
    distribution_delta: {
      appeal: {
        from_count: 4,
        to_count: 4,
        confidence_floor: "high",
        values: {
          price: { from: 0.75, to: 0.25, delta: -0.5, support_count: 4 },
          quality_proof: { from: 0.25, to: 0.75, delta: 0.5, support_count: 4 },
        },
      },
    },
    coverage_flags: [],
  });

  assert.equal(candidates.candidates.length, 2);
  assert.equal(candidates.candidates[0].candidate_type, "appeal_shift");
  assert.equal(candidates.candidates[0].claim_kind, "computed");
  assert.equal(candidates.candidates[0].strength, "strong");
  const validation = validateAgainst("change-candidate.schema.json", candidates);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});

test("detectChangeCandidates caps low confidence candidates and blocks missing audience_read", () => {
  const out = detectChangeCandidates({
    from_snapshot_id: "a",
    to_snapshot_id: "b",
    inventory_delta: { created: [], deleted: [], persisted: [], untrackable: [] },
    update_delta: { same_library_id_changed_recipe: [] },
    distribution_delta: {
      audience_read: { from_count: 0, to_count: 0, missing_axis: true, values: {} },
      appeal: {
        from_count: 2,
        to_count: 2,
        confidence_floor: "low",
        values: { price: { from: 1, to: 0, delta: -1, support_count: 2 } },
      },
    },
    coverage_flags: [],
  });

  assert.equal(out.candidates.some((c) => c.candidate_type === "audience_read_shift"), false);
  assert.equal(out.candidates.find((c) => c.axis === "appeal").strength, "medium");
  assert.ok(out.coverage_flags.some((f) => /audience_read/.test(f)));
  const validation = validateAgainst("change-candidate.schema.json", out);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});
