// The ONE contract every ad-type analysis adapter implements (mirrors define-flow.mjs; cf. Claude Code's
// Tool.ts + TOOL_DEFAULTS). An adapter calls defineAdType({...}) and default-exports the result; the analysis
// router resolves it by the classifier's `ad_type` and reads `adapter.emphasizes/requires/gates` to tune which
// axes the per-image analysts emphasize. Safe defaults injected so a new adapter needs only name + grounds_in +
// emphasizes. Frozen so an adapter can't be mutated at runtime.
//
// PROVENANCE IS MANDATORY: `grounds_in` is REQUIRED — every adapter must cite its basis in
// knowledge/reference/ad-taxonomy.md so that adding/changing a type has a citable reference to argue from.
//
// Contract:
//   name        string   ad_type id ("informational", "transformational", "social_proof", "default") — routing key
//   grounds_in  string   REQUIRED — citation into ad-taxonomy.md (framework + execution style, e.g.
//                         "Puto & Wells (1984) informational; Belch & Belch demonstration/scientific/comparison")
//   emphasizes  string[] REQUIRED — the axes this ad type makes primary ("copy"|"layout"|"visual"|"intent"|"binding")
//   requires    string[] type-specific extracts that should be present for this type (default [])
//   gates       string[] flags to raise when a `requires` item is missing (default [])
//   isEnabled   () => bool feature gate (default: enabled)
export function defineAdType(def) {
  if (!def || typeof def !== "object") throw new Error("defineAdType: a definition object is required");
  if (!def.name) throw new Error("defineAdType: `name` is required");
  if (!def.grounds_in || typeof def.grounds_in !== "string") throw new Error(`defineAdType(${def.name}): \`grounds_in\` (a citation into ad-taxonomy.md) is REQUIRED — provenance is mandatory`);
  if (!Array.isArray(def.emphasizes) || def.emphasizes.length === 0) throw new Error(`defineAdType(${def.name}): \`emphasizes\` (the primary axes) required`);
  return Object.freeze({
    requires: [],
    gates: [],
    isEnabled: () => true,
    ...def,
  });
}
