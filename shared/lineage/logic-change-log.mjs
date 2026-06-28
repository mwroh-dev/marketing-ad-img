// Layer B — the global audit log of SHARED-LOGIC changes (provenance-lineage.md). A human review finds an analysis
// wrong; the fix is a change to shared logic = a git commit. This records {which ad exposed it, the finding, the
// Q&A, the commit, the impact}. The as-is/to-be/diff of the logic IS the commit (git reused); this is the
// human-provenance + impact layer on top. Append-only at STATE_DIR/audit/logic-changes.jsonl.
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { staleArtifacts, allStale } from "./staleness.mjs";
import { logicVersion } from "./logic-version.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = resolve(HERE, "..", "..", "schemas/lineage/logic-change.schema.json");
const stateDirDefault = () => process.env.GEN_ADS_IMG_STATE || resolve(process.cwd(), ".generate-ads-img");
const logPath = (stateDir) => resolve(stateDir, "audit", "logic-changes.jsonl");

const ajv = new Ajv2020({ allErrors: true, strict: false });
let _validate;
function validate(rec) {
  if (!_validate) _validate = ajv.compile(JSON.parse(readFileSync(SCHEMA, "utf8")));
  return _validate(rec) ? null : ajv.errorsText(_validate.errors);
}

// impact = stale artifacts in the human's verdict scope (current = the NEW logic version after the fix commit).
function computeImpact({ trigger, scope, stateDir, current, logicVersionFn }) {
  const v = current || (logicVersionFn || logicVersion)().version;
  let stale;
  if (scope === "global") stale = allStale({ stateDir, current: v });
  else if (scope === "pattern") stale = staleArtifacts(trigger.persona_id, { stateDir, current: v, pattern_tag: trigger.pattern_tag });
  else if (scope === "slot") stale = staleArtifacts(trigger.persona_id, { stateDir, current: v, slot: trigger.slot });
  else stale = staleArtifacts(trigger.persona_id, { stateDir, current: v });   // persona
  return { stale_count: stale.length, stale_refs: stale.map((s) => s.ref), pattern_tags: [...new Set(stale.map((s) => s.pattern_tag))] };
}

export function recordLogicChange({ trigger, finding, qa_log = [], commit_sha, scope = "slot" }, opts = {}) {
  if (!trigger?.persona_id) throw new Error("recordLogicChange: trigger.persona_id required");
  if (!finding) throw new Error("recordLogicChange: finding required");
  if (!commit_sha) throw new Error("recordLogicChange: commit_sha required (the logic fix is a commit)");
  const stateDir = opts.stateDir || stateDirDefault();
  const at = opts.now || new Date().toISOString();
  const impact = computeImpact({ trigger, scope, stateDir, current: opts.current, logicVersionFn: opts.logicVersionFn });
  const change_id = opts.changeId || `lc-${at.replace(/[:.TZ-]/g, "").slice(0, 14)}-${String(commit_sha).slice(0, 7)}`;
  const rec = { change_id, at, trigger, finding, qa_log, commit_sha, scope, impact };
  const err = validate(rec);
  if (err) throw new Error(`recordLogicChange: record invalid — ${err}`);
  mkdirSync(dirname(logPath(stateDir)), { recursive: true });
  appendFileSync(logPath(stateDir), JSON.stringify(rec) + "\n", "utf8");
  return rec;
}

export function readLogicChanges(stateDir = stateDirDefault()) {
  const p = logPath(stateDir);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
