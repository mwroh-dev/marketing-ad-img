// The ONE contract every collection source implements (cf. Claude Code's Tool.ts + buildTool/TOOL_DEFAULTS).
// A source adapter calls defineFlow({...}) and default-exports the result; the harness runs `flow.collect(ctx)`
// and reads `flow.source/entrypoints/imgMatch`. Safe defaults are injected so a new source needs only
// `name + entrypoints + collect`. Frozen so an adapter can't be mutated at runtime.
//
// Contract:
//   name        string   short registry id ("meta", "google") — used for dispatch
//   source      string   manifest source enum ("meta_ad_library") — defaults to name
//   entrypoints string[] public front-door URLs (the code-enforced no-URL-assembly whitelist the harness uses)
//   collect     (ctx) => Promise  the per-source sequence; touches ONLY ctx (never lib.mjs)
//   imgMatch    (url)  => bool     capture predicate (default: never)
//   acceptModes string[]          query modes this source accepts (default keyword+advertiser)
//   config      object            per-source knobs (selectors, region, filter params) — not literals in collect
//   isEnabled   () => bool         feature gate (default: enabled)
//   (B) flags   paginationMode/maxScroll/nonIntrusive — declarative; the engine reads them
export function defineFlow(def) {
  if (!def || typeof def !== "object") throw new Error("defineFlow: a definition object is required");
  if (!def.name) throw new Error("defineFlow: `name` is required");
  if (!Array.isArray(def.entrypoints) || def.entrypoints.length === 0) throw new Error(`defineFlow(${def.name}): \`entrypoints\` (public front-door URLs) required`);
  if (typeof def.collect !== "function") throw new Error(`defineFlow(${def.name}): \`collect(ctx)\` function required`);
  return Object.freeze({
    acceptModes: ["keyword", "advertiser"],
    config: {},
    imgMatch: () => false,
    isEnabled: () => true,
    ...def,
    source: def.source ?? def.name,
  });
}
