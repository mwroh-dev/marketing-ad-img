import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { persistArtifact } from "./persist-artifact.mjs";
import { recordLogicChange, readLogicChanges } from "./logic-change-log.mjs";

function seed(stateDir, version) {
  const lv = () => ({ version, method: "content" });
  const mk = (img, tag) => persistArtifact({ kind: "perception", key: { persona_id: "p", image_ref: img, run_id: "r1" }, payload: { x: 1 }, pattern_tag: tag, produced_by: "perception-extractor" }, { stateDir, logicVersionFn: lv });
  mk("ad-9.jpg", "social_proof:trust×action");
  mk("ad-9b.jpg", "social_proof:trust×action");
  mk("ad-22.jpg", "transformational:function×discovery");
}

test("recordLogicChange writes a valid record + impact = stale in the verdict scope", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "lc-"));
  seed(stateDir, "v1");                                 // stored at v1; the fix bumps to v2
  const rec = recordLogicChange(
    { trigger: { persona_id: "p", slot: "ad-9", pattern_tag: "social_proof:trust×action" },
      finding: "social_proof mislabeled — it's a demonstration", qa_log: [{ role: "user", text: "이거 왜 이래?" }, { role: "agent", text: "타입 규칙이 댓글을 testimonial로 오인" }],
      commit_sha: "abc1234def", scope: "pattern" },
    { stateDir, current: "v2", now: "2026-06-26T01:02:03Z" },
  );
  assert.match(rec.change_id, /^lc-\d{8}\d{6}-abc1234$/);
  assert.equal(rec.impact.stale_count, 2);             // both social_proof ads, not the transformational one
  assert.deepEqual(rec.impact.pattern_tags, ["social_proof:trust×action"]);
  assert.equal(readLogicChanges(stateDir).length, 1);
});

test("scope widens/narrows the impact; records append", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "lc2-"));
  seed(stateDir, "v1");
  const slot = recordLogicChange({ trigger: { persona_id: "p", slot: "ad-22" }, finding: "x", commit_sha: "c1", scope: "slot" }, { stateDir, current: "v2" });
  assert.equal(slot.impact.stale_count, 1);            // only ad-22
  const persona = recordLogicChange({ trigger: { persona_id: "p" }, finding: "y", commit_sha: "c2", scope: "persona" }, { stateDir, current: "v2" });
  assert.equal(persona.impact.stale_count, 3);         // all 3
  assert.equal(readLogicChanges(stateDir).length, 2);  // appended
});

test("required fields enforced (finding, commit_sha)", () => {
  const stateDir = mkdtempSync(resolve(tmpdir(), "lc3-"));
  assert.throws(() => recordLogicChange({ trigger: { persona_id: "p" }, commit_sha: "c" }, { stateDir, current: "v" }), /finding required/);
  assert.throws(() => recordLogicChange({ trigger: { persona_id: "p" }, finding: "f" }, { stateDir, current: "v" }), /commit_sha required/);
});
