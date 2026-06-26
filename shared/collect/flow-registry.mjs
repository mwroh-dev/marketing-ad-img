// Source registry. Each source registers by default-exporting its defineFlow() from flows/<source>/flow.mjs.
// Dispatch is by `name` (collision-free). Adding a source = import it here; the harness needs no edit.
import meta from "../../flows/meta-ad-library/flow.mjs";
import google from "../../flows/google-ads-transparency/flow.mjs";

const FLOWS = [meta, google];

export function getAllFlows() {
  return FLOWS;
}

export function getFlow(name) {
  const f = FLOWS.find((x) => x.name === name);
  if (!f) throw new Error(`unknown flow: '${name}' (registered: ${FLOWS.map((x) => x.name).join(", ")})`);
  return f;
}

// Enabled = feature-gated ∧ every entrypoint is an https public front-door (sanity gate; the per-navigation
// no-URL-assembly whitelist is enforced in ad-collect-harness.goto via matchToolEntry against flow.entrypoints).
export function getEnabledFlows() {
  return FLOWS.filter((f) => f.isEnabled() && f.entrypoints.every((e) => /^https:\/\/[^/]+\//.test(e)));
}
