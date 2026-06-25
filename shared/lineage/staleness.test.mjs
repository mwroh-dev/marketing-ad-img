import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { persistArtifact, refOf } from "./persist-artifact.mjs";
import { staleArtifacts, allStale, listPersonas } from "./staleness.mjs";

function seed(stateDir, version) {
  const lv = () => ({ version, method: "content" });
  const key = (img) => ({ persona_id: "p", image_ref: img, run_id: "r1" });
  persistArtifact({ kind: "perception", key: key("ad-9.jpg"), payload: { x: 1 }, pattern_tag: "social_proof:trust×action", produced_by: "perception-extractor" }, { stateDir, logicVersionFn: lv });
  persistArtifact({ kind: "strategy", key: key("ad-9.jpg"), payload: { x: 1 }, pattern_tag: "social_proof:trust×action", produced_by: "strategy-projector", derived_from: [{ kind: "perception", ref: refOf("p", "ad-9", "perception") }] }, { stateDir, logicVersionFn: lv });
  persistArtifact({ kind: "perception", key: key("ad-22.jpg"), payload: { x: 1 }, pattern_tag: "transformational:function×discovery", produced_by: "perception-extractor" }, { stateDir, logicVersionFn: lv });
}

test("nothing stale when stored version == current; everything stale when it differs", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "st-"));
  seed(stateDir, "v1");
  assert.deepEqual(staleArtifacts("p", { stateDir, current: "v1" }), []);
  const stale = staleArtifacts("p", { stateDir, current: "v2" });
  assert.equal(stale.length, 3);                       // 2 kinds on ad-9 + 1 on ad-22
  assert.ok(stale.every((s) => s.stored_version === "v1" && s.current_version === "v2"));
});

test("scope filters mirror the human verdict: whole pattern vs only this ad", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "st2-"));
  seed(stateDir, "v1");
  // "all of that pattern is wrong" → by pattern_tag (only ad-9's two kinds)
  const byPattern = staleArtifacts("p", { stateDir, current: "v2", pattern_tag: "social_proof:trust×action" });
  assert.equal(byPattern.length, 2);
  assert.ok(byPattern.every((s) => s.slot === "ad-9"));
  // "only this ad" → by slot
  const bySlot = staleArtifacts("p", { stateDir, current: "v2", slot: "ad-22" });
  assert.deepEqual(bySlot.map((s) => s.kind), ["perception"]);
});

test("no index → []; allStale + listPersonas span the store", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "st3-"));
  assert.deepEqual(staleArtifacts("ghost", { stateDir, current: "v1" }), []);
  seed(stateDir, "v1");
  assert.deepEqual(listPersonas(stateDir), ["p"]);
  assert.equal(allStale({ stateDir, current: "v9" }).length, 3);
});
