// Staleness: which stored artifacts were produced by an OLDER logic version than the current plugin. This is the
// "flag only — never auto re-run" signal (provenance-lineage.md): when shared logic changes, prior artifacts in a
// scope become suspect; the human chooses what to re-run. Scope filters mirror the human's verdict — a whole
// pattern (`pattern_tag`, "all of that kind is wrong") or a single ad (`slot`, "only this one"). Read-only.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { logicVersion } from "./logic-version.mjs";

const stateDirDefault = () => process.env.GEN_ADS_IMG_STATE || resolve(process.cwd(), ".generate-ads-img");

function readIndex(stateDir, personaId) {
  const p = resolve(stateDir, "store", personaId, "index.json");
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

export function listPersonas(stateDir = stateDirDefault()) {
  try { return readdirSync(resolve(stateDir, "store"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { return []; }
}

// stale = stored logic_version !== current. opts: {stateDir, current, logicVersionFn, pattern_tag?, slot?}.
export function staleArtifacts(personaId, opts = {}) {
  const stateDir = opts.stateDir || stateDirDefault();
  const current = opts.current || (opts.logicVersionFn || logicVersion)().version;
  const idx = readIndex(stateDir, personaId);
  if (!idx) return [];
  let out = [];
  for (const [slot, item] of Object.entries(idx.items || {})) {
    for (const [kind, k] of Object.entries(item.kinds || {})) {
      if (k.logic_version !== current) {
        out.push({ persona_id: personaId, slot, kind, pattern_tag: item.pattern_tag, ref: k.ref, stored_version: k.logic_version, current_version: current });
      }
    }
  }
  if (opts.pattern_tag) out = out.filter((x) => x.pattern_tag === opts.pattern_tag);  // "all of that pattern"
  if (opts.slot) out = out.filter((x) => x.slot === opts.slot);                        // "only this ad"
  return out;
}

// convenience: stale across every persona in the store.
export function allStale(opts = {}) {
  const stateDir = opts.stateDir || stateDirDefault();
  return listPersonas(stateDir).flatMap((p) => staleArtifacts(p, { ...opts, stateDir }));
}
