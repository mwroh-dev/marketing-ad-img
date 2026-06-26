// The contract every ad-type analysis adapter implements (mirrors define-flow.mjs). defineAdType({...}) returns a
// frozen result; the analysis router resolves it by `ad_type` and the ad-type-gate consumes its `requires`/`gates`.
// `grounds_in` (a citation into ad-taxonomy.md) is REQUIRED — provenance is mandatory. (`emphasizes` was removed —
// see knowledge/reference/ad-taxonomy.md "Why `emphasizes` was removed".)
export function defineAdType(def) {
  if (!def || typeof def !== "object") throw new Error("defineAdType: a definition object is required");
  if (!def.name) throw new Error("defineAdType: `name` is required");
  if (!def.grounds_in || typeof def.grounds_in !== "string")
    throw new Error(`defineAdType(${def.name}): \`grounds_in\` (a citation into ad-taxonomy.md) is REQUIRED — provenance is mandatory`);
  return Object.freeze({ requires: [], gates: [], isEnabled: () => true, ...def });
}
