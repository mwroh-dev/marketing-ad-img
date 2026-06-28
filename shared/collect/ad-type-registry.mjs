// Ad-type adapter registry (mirrors flow-registry.mjs). Each ad type registers by default-exporting its
// defineAdType() from ad-types/<name>.mjs. The analysis router resolves an adapter by the classifier's `ad_type`
// (collision-free dispatch by `name`). Adding a type = create ad-types/<name>.mjs (with a `grounds_in` citation
// into knowledge/reference/ad-taxonomy.md) and import it here.
import informational from "./ad-types/informational.mjs";
import transformational from "./ad-types/transformational.mjs";
import socialProof from "./ad-types/social-proof.mjs";
import fallback from "./ad-types/default.mjs";

const AD_TYPES = [informational, transformational, socialProof, fallback];

export function getAllAdTypes() {
  return AD_TYPES;
}

export function getAdType(name) {
  const a = AD_TYPES.find((x) => x.name === name);
  if (!a) throw new Error(`unknown ad_type: '${name}' (registered: ${AD_TYPES.map((x) => x.name).join(", ")})`);
  return a;
}

export function getEnabledAdTypes() {
  return AD_TYPES.filter((a) => a.isEnabled());
}
