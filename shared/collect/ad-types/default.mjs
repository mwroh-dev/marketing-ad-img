import { defineAdType } from "../define-ad-type.mjs";
// Fallback for hybrid / uncertain ads — no single type dominates, so all axes run evenly.
// Basis: knowledge/reference/ad-taxonomy.md (Layer 1 hybrid, the Puto & Wells 2x2 both-high case).
export default defineAdType({
  name: "default",
  grounds_in: "Puto & Wells (1984) 2x2 hybrid — uncertain/mixed, no dominant type",
  emphasizes: ["copy", "layout", "visual", "intent"],
});
