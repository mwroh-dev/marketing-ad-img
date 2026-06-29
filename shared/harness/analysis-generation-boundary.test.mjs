// Boundary contract test — the analysis→generation seam.
// The whole "durable store boundary" design rests on ONE invariant: generation may start ONLY when analysis has
// been PERSISTED into the provenanced store (via close-analysis), and is BLOCKED otherwise. The pieces each have
// unit tests (close-analysis.test.mjs, validate-store.test.mjs); this test CHAINS them as the actual gate:
//   close-analysis (persist) → validate-store (the generation entry gate), in one consumer cwd.
// If this passes, "skip the persist step → generation is blocked" is guaranteed by code, not by orchestrator prose.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const CLOSE = resolve("shared/harness/close-analysis.mjs");
const TSX = resolve("node_modules/.bin/tsx");
const GATE = resolve("shared/harness/validate-store.ts");
const CONS = join(tmpdir(), "gai-boundary-test");                 // a consumer cwd
const STATE = join(CONS, ".generate-ads-img");
const reset = () => rmSync(CONS, { recursive: true, force: true });
after(reset);

// write one per-kind staging artifact at runs/{run}/analysis/{kindDir}/{kindDir}-{i}.json (the layout the analysts produce).
function stage(run, kindDir, i, obj) { const d = join(STATE, "runs", run, "analysis", kindDir); mkdirSync(d, { recursive: true }); writeFileSync(join(d, `${kindDir}-${i}.json`), JSON.stringify(obj)); }
function manifest(run, stg) { const d = join(STATE, "runs", run); mkdirSync(d, { recursive: true }); writeFileSync(join(d, "run.json"), JSON.stringify({ run_id: run, stage: stg, counts: {}, stage_history: [] })); }
function closeAnalysis(run) { try { return { code: 0, out: execFileSync("node", [CLOSE, run], { cwd: CONS, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; } catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; } }
function gate(persona) { try { return { code: 0, out: execFileSync(TSX, [GATE, persona, STATE], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; } catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; } }

// a real per-ad analysis chain in staging (perception=ocr root + the kinds persist-analysis-run reads).
function stageAnalyzedAd(run, i, persona) {
  const ir = `runs/${run}/ad-creatives/${persona}/images/ad-${i}.jpg`;
  stage(run, "ocr", i, { image_ref: ir, persona_id: persona, medium: "flat" });               // perception (root)
  stage(run, "type", i, { image_ref: ir, persona_id: persona, ad_type: "informational" });
  stage(run, "copy", i, { image_ref: ir, persona_id: persona });
  stage(run, "layout", i, { image_ref: ir, persona_id: persona });
  stage(run, "visual", i, { image_ref: ir, persona_id: persona });
  stage(run, "intent", i, { image_ref: ir, persona_id: persona });
  stage(run, "strategy", i, { image_ref: ir, persona_id: persona, benefit_vector: { primary: "function" }, funnel_intent: { stage: "discovery" } });
}

test("BOUNDARY: analysis persisted (close-analysis ran) → generation gate PASSes (exit 0)", () => {
  reset();
  const R = "run-ok", P = "p";
  manifest(R, "screened");
  stageAnalyzedAd(R, 0, P);
  const c = closeAnalysis(R);
  assert.equal(c.code, 0, `close-analysis should persist: ${c.out}`);
  const g = gate(P);
  assert.equal(g.code, 0, `gate should PASS on a provenanced store: ${g.out}`);
  assert.match(g.out, /STORE PASS/);
});

test("BOUNDARY: analysis NOT persisted (no store) → generation gate BLOCKS (exit 1)", () => {
  reset();
  mkdirSync(STATE, { recursive: true });                          // consumer exists, but no analysis was persisted
  const g = gate("p");
  assert.equal(g.code, 1, "gate must block generation when nothing was persisted");
});

test("BOUNDARY: persist step skipped/failed (empty staging → close-analysis exits 1) → gate still BLOCKS", () => {
  reset();
  const R = "run-empty", P = "p";
  manifest(R, "screened");
  mkdirSync(join(STATE, "runs", R, "analysis"), { recursive: true });   // staging dir exists but empty
  const c = closeAnalysis(R);
  assert.equal(c.code, 1, "close-analysis must fail loudly on empty staging");
  const g = gate(P);
  assert.equal(g.code, 1, "with no persisted store, generation stays blocked");
});
