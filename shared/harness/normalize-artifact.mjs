// Deterministic per-kind output normalizer — the tail step that conforms a high-agency agent's drifted SHAPE to
// its schema WITHOUT touching content. Posture differs by the agent's ROLE (a judgment agent's shape is fixed; a
// creative agent's content is not ours to rewrite):
//   · judgment artifact (critic-verdict): SCHEMA-WHITELIST — keep only schema-defined fields, drop the model's
//     extra bookkeeping (run_id, passing/failing lists, repair_log), and undo the rename (candidate_verdicts →
//     verdicts). The verdict CONTENT (pass, issues, risk_flags) is preserved verbatim — only the envelope changes.
//   · creative artifact (creative-brief): CONSERVATIVE — strip ONLY the known meta annotations the model adds
//     (direction_repair_note). Never blanket-strip: a genuinely new substance field is LEFT for the conformance
//     gate to surface (we do not silently discard creative output). core_message / angles content is untouched.
// Unknown kinds → no-op. Every drop/rename is logged (observability: it records that the agent drifted). No LLM.
//
// Usage: node shared/harness/normalize-artifact.mjs <kind> <file.json>   (writes the conformed file back in place)
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// posture per artifact kind. whitelist → keep only schema fields (+ rename); dropMeta → strip only these fields.
const RULES = {
  "critic-verdict": { whitelist: true, rename: { candidate_verdicts: "verdicts" }, arrayKey: "verdicts" },
  "creative-brief": { dropMeta: ["direction_repair_note"], metaInArrays: ["angles"] },
};

function findSchema(kind, dir = resolve(ROOT, "schemas")) {
  for (const e of readdirSync(dir)) {
    const p = resolve(dir, e);
    if (statSync(p).isDirectory()) { const f = findSchema(kind, p); if (f) return f; }
    else if (e === `${kind}.schema.json`) return p;
  }
  return null;
}

// keep only `allowed` keys on an object; record the dropped ones (prefixed for the log).
function pick(obj, allowed, dropped, prefix) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (allowed.includes(k)) out[k] = obj[k];
    else dropped.push(prefix + k);
  }
  return out;
}

export function normalizeArtifact(kind, data) {
  const rule = RULES[kind];
  const dropped = [], renamed = [];
  if (!rule || data == null || typeof data !== "object") return { data, dropped, renamed, changed: false };

  let out = { ...data };

  // 1) rename a renamed field back (judgment artifacts) — only if the target is absent (don't clobber)
  for (const [from, to] of Object.entries(rule.rename || {})) {
    if (from in out && !(to in out)) { out[to] = out[from]; delete out[from]; renamed.push(`${from}→${to}`); }
  }

  // 2a) judgment: keep only schema-defined fields (top-level + per array item)
  if (rule.whitelist) {
    const schema = JSON.parse(readFileSync(findSchema(kind), "utf8"));
    const topAllowed = Object.keys(schema.properties || {});
    out = pick(out, topAllowed, dropped, "");
    const ak = rule.arrayKey;
    if (ak && Array.isArray(out[ak])) {
      const itemAllowed = Object.keys(schema.properties?.[ak]?.items?.properties || {});
      if (itemAllowed.length) out[ak] = out[ak].map((it) => (it && typeof it === "object" ? pick(it, itemAllowed, dropped, `${ak}[].`) : it));
    }
  }

  // 2b) creative: strip ONLY known meta fields (top-level + inside named arrays); leave everything else
  for (const m of rule.dropMeta || []) {
    if (m in out) { delete out[m]; dropped.push(m); }
  }
  for (const arr of rule.metaInArrays || []) {
    if (Array.isArray(out[arr])) out[arr] = out[arr].map((it) => {
      if (it && typeof it === "object") for (const m of rule.dropMeta || []) if (m in it) { delete it[m]; dropped.push(`${arr}[].${m}`); }
      return it;
    });
  }

  return { data: out, dropped, renamed, changed: dropped.length > 0 || renamed.length > 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [kind, file] = process.argv.slice(2);
  if (!kind || !file || !existsSync(file)) { console.error("Usage: node shared/harness/normalize-artifact.mjs <kind> <file.json>"); process.exit(2); }
  const { data, dropped, renamed, changed } = normalizeArtifact(kind, JSON.parse(readFileSync(file, "utf8")));
  if (changed) {
    writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
    console.log(`normalized ${basename(file)} (${kind})${renamed.length ? ` · renamed ${renamed.join(", ")}` : ""}${dropped.length ? ` · dropped ${dropped.join(", ")}` : ""}`);
  } else {
    console.log(`${basename(file)} (${kind}) already conformant — no change`);
  }
}
