import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const CLOSE = resolve("shared/harness/close-analysis.mjs");
const CONS = join(tmpdir(), "gai-close-analysis-test");   // a consumer cwd (advanceStage is cwd-relative)
const reset = () => rmSync(CONS, { recursive: true, force: true });
after(reset);

function stage(run, kindDir, i, obj) { const d = join(CONS, ".generate-ads-img", "runs", run, "analysis", kindDir); mkdirSync(d, { recursive: true }); writeFileSync(join(d, `${kindDir}-${i}.json`), JSON.stringify(obj)); }
function manifest(run, stg) { const d = join(CONS, ".generate-ads-img", "runs", run); mkdirSync(d, { recursive: true }); writeFileSync(join(d, "run.json"), JSON.stringify({ run_id: run, stage: stg, counts: {}, stage_history: [] })); }
function run(runId) { try { return { code: 0, out: execFileSync("node", [CLOSE, runId], { cwd: CONS, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; } catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; } }
function adCreative(run, persona, creatives) {
  const d = join(CONS, ".generate-ads-img", "runs", run, "ad-creatives", persona);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "ad-creative.json"), JSON.stringify({ persona_id: persona, captured_at: "2026-06-01", creatives }));
}

test("per-kind staging → persists store envelopes (provenance-stamped) + advances stage to analyzed", () => {
  reset();
  const R = "run-x"; manifest(R, "screened");
  const ir = "runs/run-x/ad-creatives/p/images/ad-0.jpg";
  stage(R, "ocr", 0, { image_ref: ir, persona_id: "p", medium: "flat" });        // perception
  stage(R, "type", 0, { image_ref: ir, persona_id: "p", ad_type: "informational" });
  stage(R, "strategy", 0, { image_ref: ir, persona_id: "p", benefit_vector: { primary: "function" }, funnel_intent: { stage: "discovery" } });
  const r = run(R);
  assert.equal(r.code, 0, r.out);
  const env = join(CONS, ".generate-ads-img", "store", "p", "ad-0", "perception.json");
  assert.ok(existsSync(env), "store envelope written");
  assert.ok(JSON.parse(readFileSync(env)).logic_version, "envelope is provenance-stamped (not raw)");
  assert.equal(JSON.parse(readFileSync(join(CONS, ".generate-ads-img", "runs", R, "run.json"))).stage, "analyzed");
});

test("close-analysis freezes a run-local creative snapshot while that run is store-latest", () => {
  reset();
  const R = "run-freeze"; manifest(R, "screened");
  const ir = "runs/run-freeze/ad-creatives/p/images/ad-0.jpg";
  adCreative(R, "p", [{ library_id: "L1", image_file: "images/ad-0.jpg", started_at: "2026-05-01", status: "active", advertiser_name: "adv" }]);
  stage(R, "ocr", 0, { image_ref: ir, persona_id: "p", canvas: { dominant_colors: ["#fff"] }, text_elements: [{ id: "t1", content: "proof" }], graphic_elements: [], observation_confidence: { text: "high" } });
  stage(R, "type", 0, { image_ref: ir, persona_id: "p", ad_type: "informational" });
  stage(R, "copy", 0, { image_ref: ir, persona_id: "p", copy_elements: [{ content: "proof", text_role: "headline", hook_type: "result", confidence: "high" }] });
  stage(R, "layout", 0, { image_ref: ir, persona_id: "p", composition_type: "centered_product", text_density: "low", comfort: { crowding: 0.1, awkward_placement: false, breathing_room: true }, confidence: "high" });
  stage(R, "visual", 0, { image_ref: ir, persona_id: "p", medium: "photo", scene_class: { setting: "studio_plain", product_state: "standalone", prop_density: "minimal" }, register: "clean_minimal", confidence: "high" });
  stage(R, "intent", 0, { image_ref: ir, persona_id: "p", appeal: "quality_proof", funnel_stage: "consideration", confidence: "high" });
  stage(R, "strategy", 0, { image_ref: ir, persona_id: "p", benefit_vector: { primary: "function" }, funnel_intent: { stage: "discovery" } });

  const r = run(R);
  assert.equal(r.code, 0, r.out);
  const snapshotPath = join(CONS, ".generate-ads-img", "runs", R, "creative-change", `creative-snapshot.${R}.json`);
  assert.ok(existsSync(snapshotPath), "run-local frozen snapshot written");
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  assert.equal(snapshot.coverage_flags.length, 0);
  assert.equal(snapshot.aggregate.axes.benefit_primary.values.function.count, 1);
});

test("empty staging → exit 1 (loud, never silently leaves the store to improvisation)", () => {
  reset();
  const R = "run-empty"; manifest(R, "screened");
  mkdirSync(join(CONS, ".generate-ads-img", "runs", R, "analysis"), { recursive: true });
  assert.equal(run(R).code, 1);
});
