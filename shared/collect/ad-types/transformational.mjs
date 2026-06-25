import { defineAdType } from "../define-ad-type.mjs";
// Emotional / identity-driven ads — the message is carried by scene, mood, and aspiration.
// Basis: knowledge/reference/ad-taxonomy.md (Layer 1 transformational; Layer 2 lifestyle/slice_of_life/mood_image/fantasy).
export default defineAdType({
  name: "transformational",
  grounds_in: "Puto & Wells (1984) transformational; Belch & Belch / Kotler execution styles: lifestyle / slice_of_life / mood_image / fantasy",
  emphasizes: ["visual", "intent"],
  requires: ["register"], // the named register/mood should be present
  gates: ["transformational_without_register"],
});
