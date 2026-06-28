// Pure, deterministic ad-type gate check. No LLM, no network.
// Closes the ad-type adapter seam: the classifier routes an ad to an adapter (defineAdType) that declares
// `requires` (what an ad of this type should deliver) + `gates` (the flag to raise when a requirement is unmet,
// 1:1 by index). This step checks the adapter's `requires` against the ad's completed analyses and raises the
// matching gate flags. That is where the classification finally CHANGES behavior.
import { getAdType } from "./ad-type-registry.mjs";

// One predicate per `requires` key — deterministic over the available analyses. Conservative: a requirement is
// considered SATISFIED unless we can positively show it is unmet (a missing analysis → no false alarm).
export const REQUIRE_CHECKS = {
  // informational ads should carry an extractable claim/spec (a factual benefit, price, spec, or number).
  claim_or_spec: ({ copy, intent, strategy } = {}) =>
    (copy?.copy_elements || []).some((e) => ["price", "spec_label", "badge"].includes(e.text_role) || e.hook_type === "number")
    || intent?.appeal === "quality_proof"
    || (["function", "cost"].includes(strategy?.benefit_vector?.primary)),
  // transformational ads should read as a named register/mood (visual-analyst named one).
  register: ({ visual } = {}) => !!(visual?.register && visual.register !== "other"),
  // social-proof ads should show an endorsement device (a review/comment screenshot or a quoted review).
  social_device: ({ perception, copy } = {}) =>
    (perception?.graphic_elements || []).some((g) => g.kind === "screenshot")
    || (copy?.copy_elements || []).some((e) => e.text_role === "review_quote"),
};

// analyses = { perception?, copy?, layout?, visual?, intent?, strategy? } for ONE ad.
export function checkAdTypeGates({ ad_type, analyses = {} }) {
  const adapter = getAdType(ad_type); // throws on unknown ad_type (registered-list error)
  const requires = adapter.requires || [];
  const gates = adapter.gates || [];
  const gates_raised = [];
  requires.forEach((req, i) => {
    const check = REQUIRE_CHECKS[req];
    // unknown requirement key → cannot check → do NOT raise (avoid false alarms); a known check decides.
    const satisfied = check ? check(analyses || {}) : true;   // `analyses` may be explicit null (default only guards undefined)
    if (!satisfied) gates_raised.push(gates[i] ?? `${ad_type}_missing_${req}`);
  });
  return { ad_type, requires_checked: requires, gates_raised };
}
