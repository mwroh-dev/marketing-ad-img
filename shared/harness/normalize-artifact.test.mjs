import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { normalizeArtifact } from "./normalize-artifact.mjs";

const ajv = new Ajv2020({ strict: false, allErrors: true }); addFormats(ajv);
const conforms = (kind, stage, data) => ajv.compile(JSON.parse(readFileSync(resolve(`schemas/${stage}/${kind}.schema.json`))))(data);

test("critic-verdict (judgment): drops bookkeeping + renames, PRESERVES the verdict content", () => {
  // the exact live drift: renamed field + 4 extra top-level + an extra per-item field
  const drifted = {
    run_id: "x", overall_pass: false, passing_candidates: ["c1"], failing_candidates: ["c2"], repair_log: ["fixed c2"],
    candidate_verdicts: [
      { candidate_id: "c1", pass: true, issues: [], risk_flags: [], checklist_pass: true },
      { candidate_id: "c2", pass: false, issues: ["overclaim"], risk_flags: ["overclaim"], checklist_pass: false },
    ],
  };
  const { data, dropped, renamed } = normalizeArtifact("critic-verdict", drifted);
  assert.deepEqual(Object.keys(data).sort(), ["overall_pass", "verdicts"]);
  assert.ok(renamed.includes("candidate_verdicts→verdicts"));
  assert.ok(dropped.includes("run_id") && dropped.includes("repair_log"));
  // CONTENT preserved verbatim — judgment is not ours to rewrite
  assert.equal(data.verdicts.length, 2);
  assert.deepEqual(data.verdicts[1], { candidate_id: "c2", pass: false, issues: ["overclaim"], risk_flags: ["overclaim"] });
  assert.equal(data.overall_pass, false);
  assert.ok(conforms("critic-verdict", "generation", data), "normalized critic-verdict conforms");
});

test("creative-brief (creative): strips ONLY the known meta note; leaves an unknown substance field", () => {
  const brief = {
    persona_id: "p", product_id: "x", core_message: "study calmly", forbidden_claims: [],
    angles: [
      { angle: "product_usp", direction: "show the timer in use", evidence_refs: ["r1"], direction_repair_note: "tightened" },
      { angle: "persona_response", direction: "calm focus", evidence_refs: ["r2"], new_creative_idea: "add a study-buddy" },
    ],
  };
  const { data, dropped } = normalizeArtifact("creative-brief", brief);
  // known meta stripped
  assert.ok(dropped.includes("angles[].direction_repair_note"));
  assert.ok(!("direction_repair_note" in data.angles[0]));
  // creative content untouched
  assert.equal(data.angles[0].direction, "show the timer in use");
  assert.equal(data.core_message, "study calmly");
  // CONSERVATIVE: an unknown (possibly-substance) field is NOT silently dropped — left for the gate to surface
  assert.equal(data.angles[1].new_creative_idea, "add a study-buddy");
});

test("clean artifact → no change (idempotent)", () => {
  const clean = { verdicts: [{ candidate_id: "c1", pass: true }], overall_pass: true };
  const { changed } = normalizeArtifact("critic-verdict", clean);
  assert.equal(changed, false);
});

test("unknown kind → no-op", () => {
  const x = { a: 1, b: 2 };
  const { data, changed } = normalizeArtifact("copy-layout", x);
  assert.equal(changed, false);
  assert.deepEqual(data, x);
});
