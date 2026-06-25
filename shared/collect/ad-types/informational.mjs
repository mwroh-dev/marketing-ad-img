import { defineAdType } from "../define-ad-type.mjs";
// Functional / claim-driven ads — the message is carried by facts, specs, and proof.
// Basis: knowledge/reference/ad-taxonomy.md (Layer 1 informational; Layer 2 demonstration/scientific/comparison/straight_sell).
export default defineAdType({
  name: "informational",
  grounds_in: "Puto & Wells (1984) informational; Belch & Belch execution styles: demonstration / scientific_evidence / comparison / straight_sell",
  emphasizes: ["copy", "layout", "binding"],
  requires: ["claim_or_spec"], // a functional ad should carry an extractable claim/spec
  gates: ["informational_without_claim"],
});
