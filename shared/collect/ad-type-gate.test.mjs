import test from "node:test";
import assert from "node:assert/strict";
import { checkAdTypeGates } from "./ad-type-gate.mjs";

test("informational ad with NO claim raises its gate; with a claim it is clean", () => {
  const noClaim = checkAdTypeGates({ ad_type: "informational", analyses: {
    copy: { copy_elements: [{ text_role: "headline", hook_type: "empathy" }] },
    intent: { appeal: "social_proof" }, strategy: { benefit_vector: { primary: "symbol" } },
  } });
  assert.deepEqual(noClaim.requires_checked, ["claim_or_spec"]);
  assert.deepEqual(noClaim.gates_raised, ["informational_without_claim"]);

  const withClaim = checkAdTypeGates({ ad_type: "informational", analyses: {
    copy: { copy_elements: [{ text_role: "price" }] },
  } });
  assert.deepEqual(withClaim.gates_raised, []);
});

test("social_proof ad without an endorsement device raises its gate; a screenshot clears it", () => {
  const noDevice = checkAdTypeGates({ ad_type: "social_proof", analyses: {
    perception: { graphic_elements: [{ kind: "product" }] },
    copy: { copy_elements: [{ text_role: "headline" }] },
  } });
  assert.deepEqual(noDevice.gates_raised, ["social_proof_without_device"]);

  const withScreenshot = checkAdTypeGates({ ad_type: "social_proof", analyses: {
    perception: { graphic_elements: [{ kind: "screenshot" }] },
  } });
  assert.deepEqual(withScreenshot.gates_raised, []);

  const withReviewQuote = checkAdTypeGates({ ad_type: "social_proof", analyses: {
    copy: { copy_elements: [{ text_role: "review_quote" }] },
  } });
  assert.deepEqual(withReviewQuote.gates_raised, []);
});

test("transformational ad without a named register raises its gate; a register clears it", () => {
  assert.deepEqual(checkAdTypeGates({ ad_type: "transformational", analyses: { visual: { register: "other" } } }).gates_raised,
    ["transformational_without_register"]);
  assert.deepEqual(checkAdTypeGates({ ad_type: "transformational", analyses: { visual: { register: "clean_minimal" } } }).gates_raised, []);
});

test("default ad type has no requires → never raises a gate; deterministic; unknown ad_type throws", () => {
  const d = checkAdTypeGates({ ad_type: "default", analyses: {} });
  assert.deepEqual(d.requires_checked, []);
  assert.deepEqual(d.gates_raised, []);
  const a = { ad_type: "informational", analyses: { copy: { copy_elements: [] } } };
  assert.deepEqual(checkAdTypeGates(a), checkAdTypeGates(a)); // deterministic
  assert.throws(() => checkAdTypeGates({ ad_type: "nope", analyses: {} }), /unknown ad_type/);
});
