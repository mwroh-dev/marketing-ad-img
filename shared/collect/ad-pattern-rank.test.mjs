import test from "node:test";
import assert from "node:assert/strict";
import { rankByFreq, roleDistribution, comfortStats, aggregatePattern } from "./ad-pattern-rank.mjs";

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
