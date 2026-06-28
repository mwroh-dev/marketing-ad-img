// The contract every collection source implements (frozen-factory, same shape as define-ad-type.mjs).
// defineFlow({...}) returns a frozen result; the harness runs `flow.collect(ctx)` and reads
// `flow.source`/`entrypoints`/`imgMatch`. Required: name + `entrypoints` (the code-enforced no-URL-assembly
// whitelist) + `collect(ctx)` (touches ONLY ctx, never lib.mjs); the rest default below (source ← name).
// Optional declarative flags the engine reads: paginationMode · maxScroll · nonIntrusive.
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
