// The ONE contract every ad-type analysis adapter implements (mirrors define-flow.mjs; cf. Claude Code's
// Tool.ts + TOOL_DEFAULTS). An adapter calls defineAdType({...}) and default-exports the result; the analysis
// router resolves it by the classifier's `ad_type` and reads `adapter.requires/gates` (the ad-type gate-check).
// Safe defaults injected so a new adapter needs only name + grounds_in. Frozen so it can't be mutated at runtime.
//
// HISTORY (deliberation trace — see knowledge/reference/ad-taxonomy.md "Why `emphasizes` was removed"): an
// `emphasizes` field once declared the axes a type should prioritize, to make the analysis ADAPT per ad type.
// It was removed as dead code: once every axis became a cheap text pass over the single perception, the cost
// reason to skip/weight axes evaporated (we run all axes always), and the per-type value moved downstream to
// strategy-projector / opportunity-mapper. Only the consumed levers remain — `requires`/`gates`.
//
// PROVENANCE IS MANDATORY: `grounds_in` is REQUIRED — every adapter must cite its basis in
// knowledge/reference/ad-taxonomy.md so that adding/changing a type has a citable reference to argue from.
//
// Contract:
//   name        string   ad_type id ("informational", "transformational", "social_proof", "default") — routing key
//   grounds_in  string   REQUIRED — citation into ad-taxonomy.md (framework + execution style, e.g.
//                         "Puto & Wells (1984) informational; Belch & Belch demonstration/scientific/comparison")
//   requires    string[] type-specific extracts that should be present for this type (default [])
//   gates       string[] flags to raise when a `requires` item is missing (default [], 1:1 with requires)
//   isEnabled   () => bool feature gate (default: enabled)
export function defineAdType(def) {
  if (!def || typeof def !== "object") throw new Error("defineAdType: a definition object is required");
  if (!def.name) throw new Error("defineAdType: `name` is required");
  if (!def.grounds_in || typeof def.grounds_in !== "string") throw new Error(`defineAdType(${def.name}): \`grounds_in\` (a citation into ad-taxonomy.md) is REQUIRED — provenance is mandatory`);
  return Object.freeze({
    requires: [],
    gates: [],
    isEnabled: () => true,
    ...def,
  });
}
