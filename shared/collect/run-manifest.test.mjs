import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { datedRunId, buildCollectedManifest, writeRunManifest, readManifest, advanceStage, STAGES } from "./run-manifest.mjs";

// run-manifest.mjs writes under cwd-relative .generate-ads-img/runs/… (the .mjs convention). Run the
// fs-touching tests inside a throwaway cwd so the repo state is never polluted.
const origCwd = process.cwd();
const sandbox = mkdtempSync(resolve(tmpdir(), "run-manifest-"));
process.chdir(sandbox);
test.after(() => { process.chdir(origCwd); rmSync(sandbox, { recursive: true, force: true }); });

test("datedRunId is deterministic, readable, and safeName-clean", () => {
  assert.equal(datedRunId("meta_ad_library", "keyword", "2026-06-23T14:30:00.000Z"), "2026-06-23-1430-meta-keyword");
  assert.equal(datedRunId("google_ads_transparency", "advertiser", "2026-01-02T09:05:00.000Z"), "2026-01-02-0905-google-advertiser");
});

test("buildCollectedManifest starts at collected with downstream counts null", () => {
  const m = buildCollectedManifest({
    runId: "r1", source: "meta_ad_library", track: "category_keyword", personaId: "p1",
    queries: [{ mode: "keyword", query: "타이머" }], collected: 3, now: "2026-06-23T00:00:00.000Z",
  });
  assert.equal(m.stage, "collected");
  assert.equal(m.counts.collected, 3);
  assert.equal(m.counts.kept_by_human, null);
  assert.equal(m.counts.screened, null);
  assert.equal(m.counts.analyzed, null);
  assert.equal(m.stage_history.length, 1);
  assert.equal(m.queries[0].axis, null);          // bare query → axis null
  assert.equal(m.queries[0].results_count, null);
});

test("write + read roundtrip", () => {
  const m = buildCollectedManifest({ runId: "r2", source: "meta_ad_library", track: "category_keyword", personaId: "p1", queries: [], collected: 0 });
  writeRunManifest("r2", m);
  assert.deepEqual(readManifest("r2"), m);
  assert.equal(readManifest("nope"), null);
});

test("advanceStage moves forward, merges counts, and appends history", () => {
  writeRunManifest("r3", buildCollectedManifest({ runId: "r3", source: "meta_ad_library", track: "category_keyword", personaId: "p1", queries: [], collected: 10, now: "2026-06-23T00:00:00.000Z" }));
  const m = advanceStage("r3", "human_reviewed", { kept_by_human: 7 }, "2026-06-23T01:00:00.000Z");
  assert.equal(m.stage, "human_reviewed");
  assert.equal(m.counts.kept_by_human, 7);
  assert.equal(m.counts.collected, 10);
  assert.deepEqual(m.stage_history.map((h) => h.stage), ["collected", "human_reviewed"]);
});

test("advanceStage can skip forward but never backward", () => {
  writeRunManifest("r4", buildCollectedManifest({ runId: "r4", source: "meta_ad_library", track: "category_keyword", personaId: "p1", queries: [], collected: 5 }));
  advanceStage("r4", "screened", { screened: 5 });          // collected → screened (skip human_reviewed)
  assert.throws(() => advanceStage("r4", "human_reviewed"), /backward/);
});

test("advanceStage rejects unknown stage and missing run", () => {
  assert.throws(() => advanceStage("r4", "bogus"), /unknown stage/);
  assert.throws(() => advanceStage("ghost", "screened"), /no run manifest/);
});

test("STAGES order is the canonical pipeline", () => {
  assert.deepEqual(STAGES, ["collected", "human_reviewed", "screened", "analyzed"]);
});
