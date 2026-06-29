import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { renderChangeReport } from "./render-change-report.mjs";
import { validateAgainst } from "../collect/schema-validate.mjs";

const RENDER = resolve("shared/harness/render-change-report.mjs");

test("renderChangeReport separates computed, interpreted, inferred, and escapes dynamic content", () => {
  const report = {
    persona_id: "p<script>",
    snapshot_range: { from_snapshot_id: "a", to_snapshot_id: "b" },
    confirmed_changes: [{ claim_kind: "computed", summary: "price decreased" }],
    classified_interpretations: [{ claim_kind: "interpreted", summary: "proof-oriented shift" }],
    inferred_hypotheses: [{ claim_kind: "inferred", summary: "<img src=x onerror=alert(1)> season overlap" }],
    coverage_flags: ["no causal claim"],
    synthesis: "요약",
  };
  const validation = validateAgainst("creative-change-report.schema.json", report);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  const html = renderChangeReport(report);

  assert.match(html, /계산된 변화/);
  assert.match(html, /해석된 변화/);
  assert.match(html, /유추 가설/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test("render-change-report CLI validates input and renders populated list sections", () => {
  const dir = mkdtempSync(join(tmpdir(), "gai-render-change-report-"));
  const inPath = join(dir, "creative-change-report.json");
  const outPath = join(dir, "creative-change-report.html");
  writeFileSync(inPath, JSON.stringify({
    persona_id: "p",
    snapshot_range: { from_snapshot_id: "a", to_snapshot_id: "b" },
    confirmed_changes: [
      { claim_kind: "computed", summary: "inventory changed" },
      { claim_kind: "computed", summary: "appeal share changed" },
    ],
    classified_interpretations: [{ claim_kind: "interpreted", summary: "proof-oriented read" }],
    inferred_hypotheses: [],
    coverage_flags: ["context not supplied"],
    synthesis: "요약",
  }, null, 2));

  execFileSync("node", [RENDER, inPath, outPath], { encoding: "utf8" });
  const html = readFileSync(outPath, "utf8");
  assert.match(html, /inventory changed/);
  assert.match(html, /appeal share changed/);
  assert.match(html, /proof-oriented read/);
  assert.match(html, /context not supplied/);
});

test("renderChangeReport renders before/after creative evidence and claim chips when artifacts are supplied", () => {
  const report = {
    persona_id: "p",
    snapshot_range: { from_snapshot_id: "run-a", to_snapshot_id: "run-b" },
    confirmed_changes: [{ claim_kind: "computed", summary: "appeal share changed" }],
    classified_interpretations: [{ claim_kind: "interpreted", summary: "proof-oriented read" }],
    inferred_hypotheses: [{ claim_kind: "inferred", summary: "holiday overlap" }],
    coverage_flags: [],
    synthesis: "요약",
  };
  const diff = {
    inventory_delta: {
      created: [{ ad_key: "L4", library_id: "L4", image_ref: "runs/run-b/ad-creatives/p/images/ad-2.jpg" }],
      deleted: [{ ad_key: "L3", library_id: "L3", image_ref: "runs/run-a/ad-creatives/p/images/ad-2.jpg" }],
      persisted: [{ ad_key: "L1", library_id: "L1", image_ref: "runs/run-b/ad-creatives/p/images/ad-0.jpg" }],
      untrackable: [],
    },
    update_delta: {
      same_library_id_changed_recipe: [
        {
          library_id: "L1",
          changed_axes: ["text_hash", "appeal"],
          before: { appeal: "quality_proof" },
          after: { appeal: "emotional" },
          evidence_refs: [],
        },
      ],
    },
  };
  const candidates = {
    candidates: [
      { candidate_id: "candidate_001", candidate_type: "inventory_change", claim_kind: "computed", strength: "medium", axis: "inventory", share_delta: 0, support_count: 2 },
      { candidate_id: "candidate_002", candidate_type: "appeal_shift", claim_kind: "computed", strength: "strong", axis: "appeal", share_delta: 0.6667, support_count: 2 },
    ],
  };
  const snapshots = {
    from: {
      ads: [
        { library_id: "L1", image_ref: "runs/run-a/ad-creatives/p/images/ad-0.jpg", static_recipe: { classified: { appeal: "quality_proof" } } },
      ],
    },
    to: {
      ads: [
        { library_id: "L1", image_ref: "runs/run-b/ad-creatives/p/images/ad-0.jpg", static_recipe: { classified: { appeal: "emotional" } } },
      ],
    },
  };

  const html = renderChangeReport(report, { diff, candidates, snapshots, assetBase: "/state" });

  assert.match(html, /<h2[^>]*>Before \/ After Creatives<\/h2>/);
  assert.match(html, /<h3[^>]*>Updated<\/h3>/);
  assert.match(html, /<h3[^>]*>Created<\/h3>/);
  assert.match(html, /<h3[^>]*>Deleted<\/h3>/);
  assert.match(html, /class="chip chip-computed"/);
  assert.match(html, /class="chip chip-inferred"/);
  assert.match(html, /class="chip chip-strength"/);
  assert.match(html, /src="\/state\/runs\/run-a\/ad-creatives\/p\/images\/ad-0\.jpg"/);
  assert.match(html, /src="\/state\/runs\/run-b\/ad-creatives\/p\/images\/ad-0\.jpg"/);
  assert.match(html, /quality_proof/);
  assert.match(html, /emotional/);
});

test("render-change-report CLI enriches the report from frozen snapshots and diff artifacts", () => {
  const stateDir = mkdtempSync(join(tmpdir(), "gai-render-change-state-"));
  const reportDir = join(stateDir, "runs", "report-run", "creative-change");
  const fromDir = join(stateDir, "runs", "run-a", "creative-change");
  const toDir = join(stateDir, "runs", "run-b", "creative-change");
  const fromImageDir = join(stateDir, "runs", "run-a", "ad-creatives", "p", "images");
  const toImageDir = join(stateDir, "runs", "run-b", "ad-creatives", "p", "images");
  const inPath = join(reportDir, "creative-change-report.json");
  const outPath = join(reportDir, "creative-change-report.html");
  mkdirSync(reportDir, { recursive: true });
  mkdirSync(fromDir, { recursive: true });
  mkdirSync(toDir, { recursive: true });
  mkdirSync(fromImageDir, { recursive: true });
  mkdirSync(toImageDir, { recursive: true });
  writeFileSync(join(fromImageDir, "ad-0.jpg"), "fixture image");
  writeFileSync(join(toImageDir, "ad-0.jpg"), "fixture image");

  writeFileSync(inPath, JSON.stringify({
    persona_id: "p",
    snapshot_range: { from_snapshot_id: "run-a", to_snapshot_id: "run-b" },
    confirmed_changes: [{ claim_kind: "computed", summary: "updated L1" }],
    classified_interpretations: [{ claim_kind: "interpreted", summary: "appeal changed" }],
    inferred_hypotheses: [],
    coverage_flags: [],
    synthesis: "요약",
  }, null, 2));
  writeFileSync(join(reportDir, "creative-diff.json"), JSON.stringify({
    inventory_delta: { created: [], deleted: [], persisted: [], untrackable: [] },
    update_delta: {
      same_library_id_changed_recipe: [
        { library_id: "L1", changed_axes: ["appeal"], before: { appeal: "quality_proof" }, after: { appeal: "emotional" }, evidence_refs: [] },
      ],
    },
  }, null, 2));
  writeFileSync(join(reportDir, "change-candidates.json"), JSON.stringify({
    candidates: [
      { candidate_id: "candidate_001", candidate_type: "appeal_shift", claim_kind: "computed", strength: "strong", axis: "appeal", share_delta: 0.5, support_count: 2 },
    ],
  }, null, 2));
  writeFileSync(join(fromDir, "creative-snapshot.run-a.json"), JSON.stringify({
    ads: [{ library_id: "L1", image_ref: "runs/run-a/ad-creatives/p/images/ad-0.jpg", static_recipe: { classified: { appeal: "quality_proof" } } }],
  }, null, 2));
  writeFileSync(join(toDir, "creative-snapshot.run-b.json"), JSON.stringify({
    ads: [{ library_id: "L1", image_ref: "runs/run-b/ad-creatives/p/images/ad-0.jpg", static_recipe: { classified: { appeal: "emotional" } } }],
  }, null, 2));

  execFileSync("node", [RENDER, inPath, outPath], { encoding: "utf8" });
  const html = readFileSync(outPath, "utf8");
  assert.match(html, /Before \/ After Creatives/);
  assert.match(html, /src="..\/..\/run-a\/ad-creatives\/p\/images\/ad-0\.jpg"/);
  assert.match(html, /src="..\/..\/run-b\/ad-creatives\/p\/images\/ad-0\.jpg"/);
});
