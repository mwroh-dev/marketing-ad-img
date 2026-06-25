import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { persistArtifact, slotOf, analysisPatternTag, refOf } from "./persist-artifact.mjs";

const FAKE_LV = () => ({ version: "abc123def456", method: "content" });   // deterministic stamp for tests

test("slotOf: image_ref → ad basename; candidate_id → itself; neither → throws", () => {
  assert.equal(slotOf({ image_ref: "runs/task6live4/ad-creatives/p/images/ad-9.jpg" }), "ad-9");
  assert.equal(slotOf({ candidate_id: "candidate_001" }), "candidate_001");
  assert.throws(() => slotOf({}), /image_ref or candidate_id/);
});

test("analysisPatternTag: {ad_type}:{benefit}×{funnel}, with unclear/default fallbacks", () => {
  assert.equal(analysisPatternTag({ benefit_vector: { primary: "trust" }, funnel_intent: { stage: "discovery" } }, { ad_type: "social_proof" }), "social_proof:trust×discovery");
  assert.equal(analysisPatternTag({}, {}), "default:unclear×unclear");
});

test("persistArtifact: writes a valid envelope to the store + records it in the persona index", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "pa-"));
  const key = { persona_id: "p-vitamin", image_ref: "runs/r1/ad-creatives/p-vitamin/images/ad-9.jpg", run_id: "r1" };
  const { ref, envelope } = persistArtifact(
    { kind: "perception", key, payload: { image_ref: key.image_ref, medium: "composite" }, pattern_tag: "social_proof:trust×discovery", produced_by: "perception-extractor" },
    { stateDir, now: "2026-06-26T00:00:00Z", logicVersionFn: FAKE_LV },
  );
  assert.equal(ref, "p-vitamin/ad-9/perception.json");
  const onDisk = JSON.parse(readFileSync(resolve(stateDir, "store", ref), "utf8"));
  assert.deepEqual(onDisk, envelope);
  assert.equal(onDisk.kind, "perception");
  assert.equal(onDisk.logic_version.version, "abc123def456");
  assert.equal(onDisk.produced_by, "perception-extractor");
  assert.equal(onDisk.payload.medium, "composite");

  const idx = JSON.parse(readFileSync(resolve(stateDir, "store", "p-vitamin", "index.json"), "utf8"));
  assert.equal(idx.persona_id, "p-vitamin");
  assert.equal(idx.items["ad-9"].pattern_tag, "social_proof:trust×discovery");
  assert.equal(idx.items["ad-9"].run_id, "r1");
  assert.ok(idx.items["ad-9"].kinds.perception);
});

test("persistArtifact: a derived artifact records its chain; index lists both kinds for the slot", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "pa2-"));
  const key = { persona_id: "p", image_ref: "ad-9.jpg", run_id: "r1" };
  persistArtifact({ kind: "perception", key, payload: { x: 1 }, pattern_tag: "t:a×b", produced_by: "perception-extractor" }, { stateDir, logicVersionFn: FAKE_LV });
  const { envelope } = persistArtifact(
    { kind: "copy", key, payload: { copy_elements: [] }, pattern_tag: "t:a×b", produced_by: "copy-analyst",
      derived_from: [{ kind: "perception", ref: refOf("p", "ad-9", "perception") }] },
    { stateDir, logicVersionFn: FAKE_LV },
  );
  assert.equal(envelope.derived_from[0].ref, "p/ad-9/perception.json");
  const idx = JSON.parse(readFileSync(resolve(stateDir, "store", "p", "index.json"), "utf8"));
  assert.deepEqual(Object.keys(idx.items["ad-9"].kinds).sort(), ["copy", "perception"]);
  assert.deepEqual(idx.items["ad-9"].kinds.copy.derived_from, [{ kind: "perception", ref: "p/ad-9/perception.json" }]);
});

test("persistArtifact: rejects a malformed envelope (missing pattern_tag) and isolates by stateDir", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "pa3-"));
  assert.throws(() => persistArtifact({ kind: "copy", key: { persona_id: "p", image_ref: "ad-1.jpg" }, payload: {}, produced_by: "x" }, { stateDir, logicVersionFn: FAKE_LV }), /pattern_tag required/);
  assert.equal(existsSync(resolve(stateDir, "store")), false);   // nothing written on rejection
});
