import test from "node:test";
import assert from "node:assert/strict";
import { aggregateMarketPosition, toRecord, BENEFITS, FUNNELS } from "./market-position-aggregate.mjs";

const records = [
  { benefit: "trust", funnel: "discovery", ad_type: "social_proof", execution_style: "testimonial", devices: ["review_screenshot"], usable: true },
  { benefit: "trust", funnel: "discovery", ad_type: "social_proof", execution_style: "testimonial", devices: ["review_screenshot"], usable: true },
  { benefit: "function", funnel: "comparison", ad_type: "informational", execution_style: "demonstration", devices: ["before_after"], usable: true },
  { benefit: "unclear", funnel: "unclear", devices: [], usable: false },
];

test("crosses into a FULL 2-D benefit×funnel grid (0 cells = whitespace signal)", () => {
  const m = aggregateMarketPosition(records);
  assert.equal(m.total_ads, 4);
  // full grid present
  for (const b of BENEFITS) for (const f of FUNNELS) assert.equal(typeof m.by_benefit_and_funnel[b][f], "number");
  assert.equal(m.by_benefit_and_funnel.trust.discovery, 2);
  assert.equal(m.by_benefit_and_funnel.function.comparison, 1);
  assert.equal(m.by_benefit_and_funnel.unclear.unclear, 1);
  assert.equal(m.by_benefit_and_funnel.function.discovery, 0); // a real but unobserved cell
});

test("dominant sorted by count; attaches common ad_type/execution/devices", () => {
  const m = aggregateMarketPosition(records);
  assert.equal(m.dominant_positions[0].position, "trust×discovery");
  assert.equal(m.dominant_positions[0].count, 2);
  assert.equal(m.dominant_positions[0].share, 0.5);
  assert.deepEqual(m.dominant_positions[0].common_execution_styles, ["testimonial"]);
  assert.deepEqual(m.dominant_positions[0].common_devices, ["review_screenshot"]);
});

test("crowded = real positions over threshold; whitespace = unobserved REAL cells (excludes unclear)", () => {
  const m = aggregateMarketPosition(records);
  assert.deepEqual(m.crowded_positions.map((p) => p.position).sort(), ["function×comparison", "trust×discovery"]);
  // 4 benefits × 4 funnels = 16 real cells; 2 observed → 14 whitespace; none contain "unclear"
  assert.equal(m.whitespace_positions.length, 14);
  assert.ok(m.whitespace_positions.every((p) => !p.position.includes("unclear")));
  assert.ok(m.whitespace_positions.some((p) => p.position === "function×discovery"));
  assert.ok(!m.whitespace_positions.some((p) => p.position === "trust×discovery")); // observed → not whitespace
});

test("high_reusability collects abstract devices from usable ads", () => {
  const m = aggregateMarketPosition(records);
  const trust = m.high_reusability_patterns.find((p) => p.position === "trust×discovery");
  assert.deepEqual(trust.devices, ["review_screenshot"]);
});

test("NOT a performance report — counts/shares only, no performance claim", () => {
  const m = aggregateMarketPosition(records);
  assert.equal("performance" in m, false);
  assert.ok(!JSON.stringify(m).includes("performance"));
  // share is prevalence (count/total), never a quality score
  assert.equal(m.dominant_positions[0].share, m.dominant_positions[0].count / m.total_ads);
});

test("thin/low-evidence surfaced; deterministic; toRecord joins strategy+adType", () => {
  assert.deepEqual(aggregateMarketPosition(records), aggregateMarketPosition(records));
  const thin = aggregateMarketPosition(records.slice(0, 2));
  assert.ok(thin.risks.some((r) => r.risk === "thin corpus"));
  const rec = toRecord(
    { benefit_vector: { primary: "trust" }, funnel_intent: { stage: "discovery" }, generation_reusability: { usable: true, reusable_devices: ["d1"] } },
    { ad_type: "social_proof", execution_style: "testimonial" },
  );
  assert.deepEqual(rec, { benefit: "trust", funnel: "discovery", ad_type: "social_proof", execution_style: "testimonial", devices: ["d1"], usable: true });
});
