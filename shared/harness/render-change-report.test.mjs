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

  assert.match(html, /확인된 변화/);
  assert.match(html, /마케팅 해석/);
  assert.match(html, /가능한 가설/);
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
      { claim_kind: "computed", summary: "광고 구성이 바뀌었습니다." },
      { claim_kind: "computed", summary: "감성 소구 비중이 증가했습니다." },
    ],
    classified_interpretations: [{ claim_kind: "interpreted", summary: "증거 중심에서 감성 중심으로 이동했습니다." }],
    inferred_hypotheses: [],
    coverage_flags: ["외부 맥락 자료가 없습니다."],
    synthesis: "요약",
  }, null, 2));

  execFileSync("node", [RENDER, inPath, outPath], { encoding: "utf8" });
  const html = readFileSync(outPath, "utf8");
  assert.match(html, /광고 구성이 바뀌었습니다/);
  assert.match(html, /감성 소구 비중이 증가했습니다/);
  assert.match(html, /증거 중심에서 감성 중심으로 이동했습니다/);
  assert.match(html, /외부 맥락 자료가 없습니다/);
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

  assert.match(html, /<h2[^>]*>전후 광고 비교<\/h2>/);
  assert.match(html, /<h3[^>]*>변경<\/h3>/);
  assert.match(html, /<h3[^>]*>신규<\/h3>/);
  assert.match(html, /<h3[^>]*>종료<\/h3>/);
  assert.match(html, /class="chip chip-computed"/);
  assert.match(html, /class="chip chip-inferred"/);
  assert.match(html, /class="chip chip-strength"/);
  assert.match(html, /src="\/state\/runs\/run-a\/ad-creatives\/p\/images\/ad-0\.jpg"/);
  assert.match(html, /src="\/state\/runs\/run-b\/ad-creatives\/p\/images\/ad-0\.jpg"/);
  assert.match(html, /품질 증명/);
  assert.match(html, /감성/);
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
  assert.match(html, /전후 광고 비교/);
  assert.match(html, /src="..\/..\/run-a\/ad-creatives\/p\/images\/ad-0\.jpg"/);
  assert.match(html, /src="..\/..\/run-b\/ad-creatives\/p\/images\/ad-0\.jpg"/);
});

test("renderChangeReport keeps human-facing sections Korean and moves agent instructions to a prompt box", () => {
  const report = {
    persona_id: "p1",
    snapshot_range: { from_snapshot_id: "run-a", to_snapshot_id: "run-b" },
    confirmed_changes: [
      { claim_kind: "computed", summary: "appeal=emotional 비중이 from 0에서 to 0.6667로 변화(delta 0.6667, support_count 2)." },
      { claim_kind: "computed", summary: "appeal=quality_proof 비중이 from 1에서 to 0.3333으로 변화(delta -0.6667, support_count 4)." },
      { claim_kind: "computed", summary: "지속된 광고 L1의 recipe가 변경됨: changed_axes = text_hash, appeal (appeal: quality_proof → emotional)." },
      { claim_kind: "computed", summary: "변화 없는 축: funnel_stage=consideration, benefit_primary=trust, visual_register=clean_minimal 모두 delta 0으로 유지." },
    ],
    classified_interpretations: [{ claim_kind: "interpreted", summary: "quality_proof 중심에서 emotional 소구로 이동했습니다." }],
    inferred_hypotheses: [],
    coverage_flags: ["no_performance_data: 노출·클릭·전환 등 성과 데이터가 없어 판단은 불가합니다."],
    synthesis: "요약",
  };

  const html = renderChangeReport(report, { candidates: { candidates: [] } });
  const visibleWithoutPrompt = html.replace(/<textarea[\s\S]*?<\/textarea>/g, "");

  assert.match(html, /광고 변화 분석/);
  assert.match(html, /주요 변화/);
  assert.match(html, /확인된 변화/);
  assert.match(html, /마케팅 해석/);
  assert.match(html, /가능한 가설/);
  assert.match(html, /분석 한계/);
  assert.match(html, /에이전트 분석 프롬프트/);
  assert.match(html, /<textarea[^>]*readonly/);
  assert.match(html, /다음 광고 변화 분석 산출물을 바탕으로/);
  assert.match(html, /creative-diff\.json/);
  assert.match(visibleWithoutPrompt, /감성/);
  assert.match(visibleWithoutPrompt, /감성 소구 비중이 0%에서 66.7%/);
  assert.match(visibleWithoutPrompt, /품질 증명 소구 비중이 100%에서 33.3%/);
  assert.match(visibleWithoutPrompt, /구성이 바뀌었습니다\. 바뀐 항목:/);
  assert.match(visibleWithoutPrompt, /바뀐 항목: 문구 변경, 소구점/);
  assert.match(visibleWithoutPrompt, /주요 구조는 유지되었습니다/);
  assert.doesNotMatch(visibleWithoutPrompt, /Marketing interpretation over deterministic candidates/);
  assert.doesNotMatch(visibleWithoutPrompt, /External context hypotheses only/);
  assert.doesNotMatch(visibleWithoutPrompt, /소구점=/);
  assert.doesNotMatch(visibleWithoutPrompt, /changed_axes/);
  assert.doesNotMatch(visibleWithoutPrompt, /변경 항목 =/);
  assert.doesNotMatch(visibleWithoutPrompt, /funnel_stage=consideration/);
  assert.doesNotMatch(visibleWithoutPrompt, /benefit_primary=trust/);
  assert.doesNotMatch(visibleWithoutPrompt, /quality_proof/);
});
