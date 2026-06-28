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

test("empty staging → exit 1 (loud, never silently leaves the store to improvisation)", () => {
  reset();
  const R = "run-empty"; manifest(R, "screened");
  mkdirSync(join(CONS, ".generate-ads-img", "runs", R, "analysis"), { recursive: true });
  assert.equal(run(R).code, 1);
});
