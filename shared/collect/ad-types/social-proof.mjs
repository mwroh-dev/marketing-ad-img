import { defineAdType } from "../define-ad-type.mjs";
// Endorsement / proof-by-others ads — the message is carried by a testimonial or a review/comment device.
// Basis: knowledge/reference/ad-taxonomy.md (Layer 2 testimonial; appeal=social_proof).
export default defineAdType({
  name: "social_proof",
  grounds_in: "Belch & Belch execution style: testimonial/spokesperson; appeal=social_proof (Kotler)",
  requires: ["social_device"], // a screenshot / quote / testimonial device the copy×graphic binding shows
  gates: ["social_proof_without_device"],
});
