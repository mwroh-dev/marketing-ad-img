import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { persistAnalysisRun } from "./persist-analysis-run.mjs";

// the analysts' real on-disk layout: one dir per KIND, file `{dir}-{N}.json` (N = ad index). perception → ocr/.
function writeKind(analysisDir, dir, i, obj) {
  const d = resolve(analysisDir, dir);
  mkdirSync(d, { recursive: true });
  writeFileSync(resolve(d, `${dir}-${i}.json`), JSON.stringify(obj));
}

test("persistAnalysisRun: persists the per-kind run layout into the per-ad store chain", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "par-state-"));
  const analysisDir = mkdtempSync(resolve(tmpdir(), "par-stg-"));
  const ir = "runs/collect-x/ad-creatives/exam-study/images/ad-0.jpg";
  writeKind(analysisDir, "ocr", 0, { image_ref: ir, persona_id: "exam-study", medium: "flat_graphic" });          // perception
  writeKind(analysisDir, "type", 0, { image_ref: ir, persona_id: "exam-study", ad_type: "informational", message_basis: "informational", confidence: "high" });
  writeKind(analysisDir, "copy", 0, { image_ref: ir, persona_id: "exam-study", copy_elements: [{ content: "Time Management Made Easy", text_role: "headline" }] });
  writeKind(analysisDir, "strategy", 0, { image_ref: ir, persona_id: "exam-study", benefit_vector: { primary: "function" }, funnel_intent: { stage: "discovery" } });

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

test("persistAnalysisRun: skips an index whose perception has no identity (nothing to key it)", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "par-state2-"));
  const analysisDir = mkdtempSync(resolve(tmpdir(), "par-stg2-"));
  writeKind(analysisDir, "ocr", 0, { medium: "flat_graphic" }); // perception present but no image_ref/persona_id
  writeKind(analysisDir, "copy", 0, { copy_elements: [] });
  assert.deepEqual(persistAnalysisRun({ analysisDir, stateDir, logicVersionFn: () => ({ version: "v", method: "content" }) }), []);
});
