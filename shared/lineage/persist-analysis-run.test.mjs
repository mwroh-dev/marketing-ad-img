import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { persistAnalysisRun } from "./persist-analysis-run.mjs";

test("persistAnalysisRun: persists a staging dir's per-ad chain into the store", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "par-state-"));
  const analysisDir = mkdtempSync(resolve(tmpdir(), "par-stg-"));
  const ad = resolve(analysisDir, "ad-0");
  mkdirSync(ad, { recursive: true });
  const ir = "runs/collect-x/ad-creatives/exam-study/images/ad-0.jpg";
  writeFileSync(resolve(ad, "perception.json"), JSON.stringify({ image_ref: ir, persona_id: "exam-study", medium: "flat_graphic" }));
  writeFileSync(resolve(ad, "ad-type.json"), JSON.stringify({ image_ref: ir, persona_id: "exam-study", ad_type: "informational", message_basis: "informational", confidence: "high" }));
  writeFileSync(resolve(ad, "copy.json"), JSON.stringify({ image_ref: ir, persona_id: "exam-study", copy_elements: [{ content: "Time Management Made Easy", text_role: "headline" }] }));
  writeFileSync(resolve(ad, "strategy.json"), JSON.stringify({ image_ref: ir, persona_id: "exam-study", benefit_vector: { primary: "function" }, funnel_intent: { stage: "discovery" } }));

  const lv = () => ({ version: "live1", method: "git", dirty: false });
  const persisted = persistAnalysisRun({ analysisDir, stateDir, logicVersionFn: lv });
  assert.equal(persisted.length, 4);                    // perception, ad-type, copy, strategy
  const env = JSON.parse(readFileSync(resolve(stateDir, "store", "exam-study", "ad-0", "perception.json"), "utf8"));
  assert.equal(env.key.run_id, "collect-x");
  assert.equal(env.pattern_tag, "informational:function×discovery");
  // strategy's chain refers to its parents that exist (ad-type, copy; intent/visual absent → omitted)
  const strat = JSON.parse(readFileSync(resolve(stateDir, "store", "exam-study", "ad-0", "strategy.json"), "utf8"));
  assert.deepEqual(strat.derived_from.map((d) => d.kind).sort(), ["ad-type", "copy"]);
  assert.ok(existsSync(resolve(stateDir, "store", "exam-study", "index.json")));
});

test("persistAnalysisRun: skips an ad with no perception (no identity to key it)", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "par-state2-"));
  const analysisDir = mkdtempSync(resolve(tmpdir(), "par-stg2-"));
  mkdirSync(resolve(analysisDir, "ad-bad"), { recursive: true });
  writeFileSync(resolve(analysisDir, "ad-bad", "copy.json"), JSON.stringify({ copy_elements: [] }));
  assert.deepEqual(persistAnalysisRun({ analysisDir, stateDir, logicVersionFn: () => ({ version: "v", method: "content" }) }), []);
});
