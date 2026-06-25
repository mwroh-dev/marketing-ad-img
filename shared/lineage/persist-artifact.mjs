// Persist ONE analysis/generation artifact into the global, persona-keyed lineage store, wrapped in an envelope
// (schemas/lineage/artifact-envelope.schema.json) that records its chain (derived_from), shared pattern
// (pattern_tag = peers), and the logic version that produced it. Standardised on STATE_DIR (same GEN_ADS_IMG_STATE
// resolution as validate-recipe). See knowledge/reference/provenance-lineage.md.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { logicVersion, ROOT } from "./logic-version.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENVELOPE_SCHEMA = resolve(HERE, "..", "..", "schemas/lineage/artifact-envelope.schema.json");
const stateDirDefault = () => process.env.GEN_ADS_IMG_STATE || resolve(process.cwd(), ".generate-ads-img");

const ajv = new Ajv2020({ allErrors: true, strict: false });
let _validate;
function validateEnvelope(env) {
  if (!_validate) _validate = ajv.compile(JSON.parse(readFileSync(ENVELOPE_SCHEMA, "utf8")));
  return _validate(env) ? null : ajv.errorsText(_validate.errors);
}

// slot = the store sub-key under a persona: the ad (image_ref basename) or the candidate id.
export function slotOf(key) {
  if (key?.image_ref) return String(key.image_ref).split("/").pop().replace(/\.[a-z0-9]+$/i, "");
  if (key?.candidate_id) return key.candidate_id;
  throw new Error("persistArtifact: key needs image_ref or candidate_id");
}

// pattern_tag — the shared pattern an analysed ad belongs to (→ its peers). "{ad_type}:{benefit}×{funnel}".
export function analysisPatternTag(strategy, adType) {
  const t = adType?.ad_type || "default";
  const b = strategy?.benefit_vector?.primary || "unclear";
  const f = strategy?.funnel_intent?.stage || "unclear";
  return `${t}:${b}×${f}`;
}

// ref = the store-relative path of an envelope (used in derived_from and the index).
export const refOf = (personaId, slot, kind) => `${personaId}/${slot}/${kind}.json`;

export function persistArtifact({ kind, key, payload, derived_from = [], pattern_tag, produced_by }, opts = {}) {
  if (!key?.persona_id) throw new Error("persistArtifact: key.persona_id required");
  if (!pattern_tag) throw new Error("persistArtifact: pattern_tag required");
  const stateDir = opts.stateDir || stateDirDefault();
  const now = opts.now || new Date().toISOString();
  const lv = (opts.logicVersionFn || logicVersion)(opts.root || ROOT);
  const slot = slotOf(key);
  const env = { kind, key, pattern_tag, derived_from, logic_version: lv, produced_by, stamped_at: now, payload };
  const err = validateEnvelope(env);
  if (err) throw new Error(`persistArtifact: envelope invalid — ${err}`);

  const ref = refOf(key.persona_id, slot, kind);
  const abs = resolve(stateDir, "store", ref);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(env, null, 2) + "\n", "utf8");
  updateIndex(stateDir, key.persona_id, slot, kind, env, now);
  return { ref, envelope: env };
}

// per-persona rollup so the viewer/agent can list every item + its kinds + pattern_tag + lineage without a walk.
function updateIndex(stateDir, personaId, slot, kind, env, now) {
  const indexPath = resolve(stateDir, "store", personaId, "index.json");
  let idx = { persona_id: personaId, updated_at: now, items: {} };
  if (existsSync(indexPath)) { try { idx = JSON.parse(readFileSync(indexPath, "utf8")); } catch { /* rebuild */ } }
  idx.updated_at = now;
  idx.items ||= {};
  const item = (idx.items[slot] ||= { slot, run_id: env.key.run_id ?? null, kinds: {} });
  item.pattern_tag = env.pattern_tag;
  if (env.key.run_id) item.run_id = env.key.run_id;
  item.kinds[kind] = { ref: refOf(personaId, slot, kind), logic_version: env.logic_version.version, derived_from: env.derived_from };
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, JSON.stringify(idx, null, 2) + "\n", "utf8");
}
