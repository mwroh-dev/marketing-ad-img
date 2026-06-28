import test from "node:test";
import assert from "node:assert/strict";
import { rankByFreq, roleDistribution, comfortStats, aggregatePattern, rankWeighted, longevityWeights, weightByImageRef } from "./ad-pattern-rank.mjs";

// These functions are VALUE-AGNOSTIC: they only group / count / average / top-k whatever values they get.
// So the fixtures use ABSTRACT placeholders (comp_a, role_h, kw1 …) — the test proves the LOGIC, not any
// domain content. (Judging whether a real image IS "lifestyle" is the agent's reasoning, checked by the
// checklist — not this deterministic test.)
const layout = [
  { composition_type: "comp_a", whitespace_ratio: 62, comfort: { crowding: 25, awkward_placement: false } },
  { composition_type: "comp_b", whitespace_ratio: 18, comfort: { crowding: 80, awkward_placement: true } },
  { composition_type: "comp_a", whitespace_ratio: 45, comfort: { crowding: 40, awkward_placement: false } },
];
const copy = [
  { copy_elements: [ { text_role: "role_h", hook_type: "hook_a" }, { text_role: "role_s", hook_type: "hook_a" } ], keywords: ["kw1", "kw2"] },
  { copy_elements: [ { text_role: "role_h", hook_type: "hook_b" }, { text_role: "role_l", hook_type: "hook_c" } ], keywords: ["kw3", "kw2"] },
  { copy_elements: [ { text_role: "role_h", hook_type: "hook_b" } ], keywords: ["kw4", "kw1"] },
];

test("rankByFreq counts, scores (freq/total), top-k, stable", () => {
  const r = rankByFreq(["comp_a", "comp_b", "comp_a"]);
  assert.deepEqual(r[0], { value: "comp_a", freq: 2, score: Math.round((2 / 3) * 1e6) / 1e6 });
  assert.equal(r[1].value, "comp_b");
});

test("roleDistribution counts text_role across all copy elements", () => {
  const d = roleDistribution(copy);
  assert.equal(d["role_h"], 3);
  assert.equal(d["role_s"], 1);
  assert.equal(d["role_l"], 1);
});

test("comfortStats averages crowding/whitespace and computes awkward_rate", () => {
  const c = comfortStats(layout);
  assert.equal(c.avg_crowding, Math.round(((25 + 80 + 40) / 3) * 100) / 100);
  assert.equal(c.avg_whitespace, Math.round(((62 + 18 + 45) / 3) * 100) / 100);
  assert.equal(c.awkward_rate, Math.round((1 / 3) * 1e6) / 1e6);
});

test("aggregatePattern is deterministic and combines layout+copy", () => {
  const a = aggregatePattern({ layoutAnalyses: layout, copyAnalyses: copy });
  const b = aggregatePattern({ layoutAnalyses: layout, copyAnalyses: copy });
  assert.deepEqual(a, b);
  assert.equal(a.image_count, 3);
  assert.equal(a.composition_top_k[0].value, "comp_a");
  // hooks across copy = hook_a,hook_a,hook_b,hook_c,hook_b → hook_a=2,hook_b=2,hook_c=1.
  // rankByFreq is stable by first-appearance; hook_a appears first → it wins the freq tie.
  assert.equal(a.hook_top_k[0].value, "hook_a");
});

const visual = [
  { medium: "med_a", scene_class: { setting: "set_a" }, register: "reg_a" },
  { medium: "med_b", scene_class: { setting: "set_b" }, register: "reg_b" },
  { medium: "med_a", scene_class: { setting: "set_a" }, register: "reg_a" },
];
const intent = [
  { appeal: "ap_a", funnel_stage: "fs_a" },
  { appeal: "ap_b", funnel_stage: "fs_b" },
  { appeal: "ap_a", funnel_stage: "fs_c" },
];

test("aggregatePattern OMITS visual/intent axes when not supplied", () => {
  const p = aggregatePattern({ layoutAnalyses: layout, copyAnalyses: copy });
  assert.equal("medium_top_k" in p, false);
  assert.equal("appeal_top_k" in p, false);
});

test("aggregatePattern adds visual + intent enum axes, deterministic", () => {
  const a = aggregatePattern({ layoutAnalyses: layout, copyAnalyses: copy, visualAnalyses: visual, intentAnalyses: intent });
  assert.deepEqual(a, aggregatePattern({ layoutAnalyses: layout, copyAnalyses: copy, visualAnalyses: visual, intentAnalyses: intent }));
  assert.equal(a.medium_top_k[0].value, "med_a");          // med_a=2 > med_b=1
  assert.equal(a.setting_top_k[0].value, "set_a");
  assert.equal(a.register_top_k[0].value, "reg_a");
  assert.equal(a.appeal_top_k[0].value, "ap_a");           // ap_a=2
  assert.equal(a.funnel_stage_top_k.length, 3);            // fs_a, fs_b, fs_c distinct
});

test("absent enum fields are filtered, never become an undefined bucket", () => {
  const sparse = [{ medium: "med_a" }, { medium: "med_a", scene_class: {} }]; // no setting/register on either
  const a = aggregatePattern({ layoutAnalyses: layout, copyAnalyses: copy, visualAnalyses: sparse });
  assert.equal(a.medium_top_k[0].value, "med_a");
  assert.equal(a.setting_top_k.length, 0);                 // all absent → empty, not [{value:undefined}]
  assert.equal(a.register_top_k.length, 0);
});

// --- Phase 6: longevity weighting ---
test("rankWeighted ranks by weight-share — a long-lived single value outranks a frequent one", () => {
  const items = [{ v: "a", w: 1 }, { v: "a", w: 1 }, { v: "b", w: 10 }];
  const r = rankWeighted(items, (i) => i.v, (i) => i.w);
  assert.equal(r[0].value, "b");      // b: weight 10/12 beats a: 2/12, despite a having freq 2
  assert.equal(r[0].freq, 1);         // freq stays the RAW count (schema-compatible)
  assert.equal(r[1].value, "a");
  assert.equal(r[1].freq, 2);
});

test("longevityWeights: running_days→weight, missing started_at→neutral 1, keyed by filename", () => {
  const w = longevityWeights([
    { image_file: "images/ad-0.jpg", started_at: "2026-01-01" },  // 90 days to today → 1 + 90/90 = 2
    { image_file: "x/ad-1.jpg" },                                  // no started_at → neutral 1 (never dropped)
  ], "2026-04-01");
  assert.equal(w["ad-0.jpg"], 2);
  assert.equal(w["ad-1.jpg"], 1);
});

test("aggregatePattern with weightOf longevity-weights the single-value axes, deterministic", () => {
  const lay = [
    { image_ref: "f1", composition_type: "c_freq" },
    { image_ref: "f2", composition_type: "c_freq" },
    { image_ref: "f3", composition_type: "c_long" },
  ];
  const weightOf = weightByImageRef({ f1: 1, f2: 1, f3: 10 });
  const a = aggregatePattern({ layoutAnalyses: lay, copyAnalyses: [], weightOf });
  assert.deepEqual(a, aggregatePattern({ layoutAnalyses: lay, copyAnalyses: [], weightOf }));
  assert.equal(a.composition_top_k[0].value, "c_long");  // long-lived single ad outranks the frequent pair
  assert.equal(a.composition_top_k[0].freq, 1);
  // unweighted: the frequent value wins (sanity that weighting changed the order)
  const u = aggregatePattern({ layoutAnalyses: lay, copyAnalyses: [] });
  assert.equal(u.composition_top_k[0].value, "c_freq");
});
