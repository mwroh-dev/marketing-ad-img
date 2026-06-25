import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { runDate, loadPersonaRuns, groupByDate, loadRecipe, qualityFlags, cardHtml, renderRecipeHtml } from "./validate-recipe.mjs";

const TEMPLATE = readFileSync(resolve(import.meta.dirname, "validate-recipe.template.html"), "utf8");

test("runDate prefers dated run-id, falls back to created_at, then mtime", () => {
  assert.equal(runDate("2026-06-23-1430-meta-keyword", { created_at: "2025-01-01T00:00:00Z" }, "2024-01-01T00:00:00Z"), "2026-06-23");
  assert.equal(runDate("task6live4", { created_at: "2026-02-26T10:00:00Z" }, "2024-01-01T00:00:00Z"), "2026-02-26");
  assert.equal(runDate("task6live4", null, "2026-03-15T10:00:00Z"), "2026-03-15");
});

test("qualityFlags surfaces low-nutrition signals; a clean recipe has none", () => {
  assert.deepEqual(qualityFlags(undefined).map((f) => f.label), ["분석 없음"]);
  assert.deepEqual(qualityFlags({}).map((f) => f.label), ["분석 없음"]);

  const clean = { perception: { observation_confidence: { text: "high", geometry: "high", scene: "high", look: "high" }, text_elements: [{ text_confidence: 0.95 }] },
    visual: { confidence: "high" }, intent: { confidence: "high" }, adType: { confidence: "high", message_basis: "informational" },
    strategy: { confidence: "high", benefit_vector: { primary: "function" }, funnel_intent: { stage: "consideration" }, first_cognition: { verdict: "ok", total_score: 12 } },
    layout: { confidence: "high" }, gate: { gates_raised: [] } };
  assert.deepEqual(qualityFlags(clean), []);

  const bad = { perception: { observation_confidence: { text: "low" }, text_elements: [{ text_confidence: 0.3 }, { text_confidence: 0.4 }] },
    visual: { confidence: "low" }, strategy: { benefit_vector: { primary: "unclear" }, funnel_intent: { stage: "unclear" } },
    adType: { message_basis: "other" }, gate: { gates_raised: ["informational_without_claim"] } };
  const labels = qualityFlags(bad).map((f) => f.label);
  assert.ok(labels.includes("관찰:text 낮음"));
  assert.ok(labels.includes("흐린 글자 2"));
  assert.ok(labels.includes("비주얼 신뢰 낮음"));
  assert.ok(labels.includes("혜택 불명확") && labels.includes("퍼널 불명확"));
  assert.ok(labels.includes("메시지유형 불명"));
  assert.ok(labels.some((l) => l.startsWith("게이트:")));
  assert.ok(qualityFlags(bad).some((f) => f.level === "bad"));
});

test("cardHtml: copyable id button (data-id = full image_ref) + recipe rows + flagged border on a bad recipe", () => {
  const recipe = { perception: { image_ref: "runs/task6live4/ad-creatives/p-vitamin/images/ad-9.jpg" },
    adType: { ad_type: "social_proof", execution_style: "testimonial" }, copy: { copy_elements: [{ text_role: "headline", content: "오늘이면 끝" }] },
    visual: { register: "clean_minimal", confidence: "low" }, strategy: { benefit_vector: { primary: "trust" }, funnel_intent: { stage: "discovery" }, first_cognition: { verdict: "ok", total_score: 11 } } };
  const html = cardHtml("task6live4", "p-vitamin", { image_file: "images/ad-9.jpg", advertiser_name: "브랜드" }, recipe);
  assert.match(html, /class="idbtn"[^>]*data-id="runs\/task6live4\/ad-creatives\/p-vitamin\/images\/ad-9\.jpg"/);
  assert.match(html, />ad-9<\/button>/);
  assert.match(html, /social_proof \/ testimonial/);
  assert.match(html, /오늘이면 끝/);
  assert.match(html, /class="card flagged"/);          // visual confidence low → bad → red border
  assert.match(html, /\/img\/task6live4\/ad-9\.jpg/);
});

test("renderRecipeHtml groups by date, fills meta + id buttons; empty persona renders a note", () => {
  const groups = [{ date: "2026-06-23", runs: [{ runId: "2026-06-23-1430-meta-keyword", personaId: "p", creatives: [{ image_file: "images/ad-0.jpg" }], analysisDir: "/nope" }] }];
  const html = renderRecipeHtml({ personaId: "p", groups }, TEMPLATE);
  assert.match(html, /페르소나 <b>p<\/b>/);
  assert.match(html, /<h2>2026-06-23<\/h2>/);
  assert.match(html, /class="idbtn"/);
  assert.ok(!html.includes("<!--GROUPS-->") && !html.includes("<!--META-->"));   // markers filled
  const empty = renderRecipeHtml({ personaId: "p", groups: [] }, TEMPLATE);
  assert.match(empty, /수집된 런이 없습니다/);
});

test("loadPersonaRuns + loadRecipe discover a persona's runs on disk and read the per-ad analysis subdir", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vr-"));
  const persona = "p-vitamin";
  const runId = "2026-06-23-1430-meta-keyword";
  const personaDir = resolve(root, "runs", runId, "ad-creatives", persona);
  mkdirSync(resolve(personaDir, "images"), { recursive: true });
  writeFileSync(resolve(personaDir, "ad-creative.json"), JSON.stringify({ persona_id: persona, creatives: [{ image_file: "images/ad-0.jpg", advertiser_name: "브랜드" }, { image_file: "video.mp4" }] }));
  const adDir = resolve(root, "runs", runId, "analysis", persona, "ad-0");
  mkdirSync(adDir, { recursive: true });
  writeFileSync(resolve(adDir, "perception.json"), JSON.stringify({ image_ref: "runs/.../ad-0.jpg", observation_confidence: { text: "high" } }));
  writeFileSync(resolve(adDir, "ad-type.json"), JSON.stringify({ ad_type: "informational", confidence: "high" }));

  const runs = loadPersonaRuns(persona, root);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].date, "2026-06-23");
  assert.equal(runs[0].creatives.length, 1);            // the video is filtered out
  const recipe = loadRecipe(runs[0].analysisDir, "ad-0");
  assert.equal(recipe.perception.observation_confidence.text, "high");
  assert.equal(recipe.adType.ad_type, "informational");
  assert.equal(recipe.copy, undefined);                 // missing artifact → undefined, not a throw

  assert.deepEqual(loadPersonaRuns("nobody", root), []); // unknown persona
  assert.equal(groupByDate(runs)[0].date, "2026-06-23");
});
