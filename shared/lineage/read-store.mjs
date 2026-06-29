// The READ half of the lineage store — the consumption API the generation pipeline uses to read PERSISTED
// analysis, so generation reads ONLY the durable per-persona store (never a collection run's scratch).
//
// This is the code INTERLOCK behind the analysis→generation boundary: `validate-store` is the gate (the sign on
// the door, run by the orchestrator), this reader is the LOCK — a consumer that calls it physically cannot proceed
// on a missing/empty store, because every entry point THROWS. The store's write half is persist-artifact.mjs /
// persist-analysis-run.mjs; this is its mirror. No LLM.
import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const stateDirDefault = () => process.env.GEN_ADS_IMG_STATE || resolve(process.cwd(), ".generate-ads-img");

// every *.json under store/{persona} except the index rollup is a lineage envelope.
function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = resolve(dir, e);
    if (statSync(p).isDirectory()) return walk(p);
    return e.endsWith(".json") && e !== "index.json" ? [p] : [];
  });
}

// Load every persisted envelope for a persona. THROWS if the store is absent or empty (the interlock).
export function loadEnvelopes(persona, opts = {}) {
  if (!persona) throw new Error("read-store: persona required");
  const stateDir = opts.stateDir || stateDirDefault();
  const storeDir = resolve(stateDir, "store", persona);
  if (!existsSync(storeDir)) throw new Error(`store empty: no store for persona '${persona}' at ${storeDir} — analysis was not persisted (run close-analysis before generation)`);
  const files = walk(storeDir);
  if (files.length === 0) throw new Error(`store empty: store/${persona} has no envelopes — analysis was not persisted (run close-analysis before generation)`);
  return files.map((f) => JSON.parse(readFileSync(f, "utf8")));
}

// Payloads of one kind across all slots (image_ref injected from the envelope key = the authoritative identity).
export function loadByKind(persona, kind, opts = {}) {
  return loadEnvelopes(persona, opts)
    .filter((e) => e.kind === kind)
    .map((e) => ({ image_ref: e.key?.image_ref, ...e.payload }));
}

// Consumption-oriented query: exactly the inputs the market-position matrix builder needs, straight from the
// durable store — so the generation pipeline never assembles them from run scratch.
export function loadMatrixInputs(persona, opts = {}) {
  const envs = loadEnvelopes(persona, opts);
  // strategy/ad-type are joined into the matrix by image_ref; an envelope missing it would silently cross-join
  // (every undefined key collapses into one bucket → corrupt aggregation). Guard at the join site — deliberately
  // NOT in loadEnvelopes, which also legitimately loads candidate-keyed generation envelopes (candidate_id, no
  // image_ref). image_ref comes from the envelope key (the authoritative identity), not the analyst payload.
  const pick = (kind) => envs.filter((e) => e.kind === kind).map((e) => {
    const image_ref = e.key?.image_ref;
    if (!image_ref) throw new Error(`store corrupted: a '${kind}' envelope for persona '${persona}' has no key.image_ref — cannot build the market-position matrix (it is the join key)`);
    return { image_ref, ...e.payload };
  });
  return { strategies: pick("strategy"), adTypes: pick("ad-type") };
}
