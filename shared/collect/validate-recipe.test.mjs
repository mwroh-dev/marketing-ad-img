import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { runDate, loadPersonaRuns, groupByDate, loadRecipe, cardHtml, renderRecipeHtml } from "./validate-recipe.mjs";

const TEMPLATE = readFileSync(resolve(import.meta.dirname, "validate-recipe.template.html"), "utf8");

test("runDate prefers dated run-id, falls back to created_at, then mtime", () => {
  assert.equal(runDate("2026-06-23-1430-meta-keyword", { created_at: "2025-01-01T00:00:00Z" }, "2024-01-01T00:00:00Z"), "2026-06-23");
  assert.equal(runDate("task6live4", { created_at: "2026-02-26T10:00:00Z" }, "2024-01-01T00:00:00Z"), "2026-02-26");
  assert.equal(runDate("task6live4", null, "2026-03-15T10:00:00Z"), "2026-03-15");
});

test("cardHtml: faithful recipe + copyable id; NO quality verdict/badge; confidence shown as neutral self-report", () => {
  const recipe = { perception: { image_ref: "runs/task6live4/ad-creatives/p-vitamin/images/ad-9.jpg" },
    adType: { ad_type: "social_proof", execution_style: "testimonial", confidence: "low" }, copy: { copy_elements: [{ text_role: "headline", content: "오늘이면 끝" }] },
    visual: { register: "clean_minimal", confidence: "high" }, strategy: { benefit_vector: { primary: "trust" }, funnel_intent: { stage: "discovery" }, first_cognition: { verdict: "ok", total_score: 11 } } };
  const html = cardHtml("task6live4", "p-vitamin", { image_file: "images/ad-9.jpg", advertiser_name: "브랜드" }, recipe);
  assert.match(html, /class="idbtn"[^>]*data-id="runs\/task6live4\/ad-creatives\/p-vitamin\/images\/ad-9\.jpg"/);
  assert.match(html, />ad-9<\/button>/);
  assert.match(html, /social_proof \/ testimonial/);
  assert.match(html, /오늘이면 끝/);
  assert.match(html, /\/img\/task6live4\/ad-9\.jpg/);
  // no system quality verdict: no "flagged" card, no badge, no "신뢰 낮음" red verdict
  assert.doesNotMatch(html, /flagged|class="badge|신뢰 낮음/);
  // confidence appears ONLY as neutral self-report data (e.g. "타입 low")
  assert.match(html, /에이전트 자기보고 신뢰/);
  assert.match(html, /타입 low/);
});

test("cardHtml: an un-analysed ad shows a neutral 'not analysed' note, not an alarm", () => {
  const html = cardHtml("task6live4", "p-vitamin", { image_file: "images/ad-3.jpg" }, {});
  assert.match(html, /아직 분석되지 않음/);
  assert.doesNotMatch(html, /flagged|badge/);
  assert.match(html, /class="idbtn"/);   // still copyable so the user can ask to analyse it
});

test("renderRecipeHtml groups by date, fills meta + id buttons; empty persona renders a note", () => {
  const groups = [{ date: "2026-06-23", runs: [{ runId: "2026-06-23-1430-meta-keyword", personaId: "p", creatives: [{ image_file: "images/ad-0.jpg" }] }] }];
  const html = renderRecipeHtml({ personaId: "p", groups, stateDir: "/nonexistent-store" }, TEMPLATE);
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
  // recipe now lives in the global store as ENVELOPES (payload unwrapped on read)
  const slotDir = resolve(root, "store", persona, "ad-0");
  mkdirSync(slotDir, { recursive: true });
  const env = (kind, payload) => ({ kind, key: { persona_id: persona, image_ref: "ad-0.jpg" }, pattern_tag: "t:a×b", derived_from: [], logic_version: { version: "x", method: "content" }, produced_by: kind, stamped_at: "z", payload });
  writeFileSync(resolve(slotDir, "perception.json"), JSON.stringify(env("perception", { image_ref: "runs/.../ad-0.jpg", observation_confidence: { text: "high" } })));
  writeFileSync(resolve(slotDir, "ad-type.json"), JSON.stringify(env("ad-type", { ad_type: "informational", confidence: "high" })));

  const runs = loadPersonaRuns(persona, root);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].date, "2026-06-23");
  assert.equal(runs[0].creatives.length, 1);            // the video is filtered out
  const recipe = loadRecipe(persona, "ad-0", root);     // reads store envelopes, unwraps payload
  assert.equal(recipe.perception.observation_confidence.text, "high");
  assert.equal(recipe.adType.ad_type, "informational");
  assert.equal(recipe.copy, undefined);                 // missing kind → undefined, not a throw

  assert.deepEqual(loadPersonaRuns("nobody", root), []); // unknown persona
  assert.equal(groupByDate(runs)[0].date, "2026-06-23");
});
