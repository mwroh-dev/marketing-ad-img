// Pure, deterministic market-position aggregation. No LLM, no network.
// Crosses per-ad strategy-projections into a benefit × funnel positioning matrix (Ries & Trout perceptual map;
// Kim & Mauborgne whitespace). Mirrors ad-pattern-rank.mjs: small value-agnostic helpers + one aggregate entry.
//
// NOT a performance report: counts are OBSERVED PREVALENCE (longevity = proxy at most), never performance.
// whitespace = a benefit×funnel cell with 0 observed ads — LOW FREQUENCY, not a guaranteed opportunity.
// The 2-D grid is FULL (0 cells carry the whitespace signal); derived lists omit-don't-zero-fill.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const BENEFITS = ["function", "cost", "trust", "symbol", "unclear"];
export const FUNNELS = ["discovery", "comparison", "action", "retention", "unclear"];

function round(n, p = 1e4) { return Math.round(n * p) / p; }

// freq-ranked distinct values (value strings only), stable by first appearance, top-k.
function topValues(values, k = 5) {
  const counts = new Map(); const order = [];
  for (const v of values) { if (v == null) continue; if (!counts.has(v)) { counts.set(v, 0); order.push(v); } counts.set(v, counts.get(v) + 1); }
  return order.map((v, i) => ({ v, c: counts.get(v), i })).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, k).map((x) => x.v);
}

// records: [{ benefit, funnel, ad_type?, execution_style?, devices?:[], usable?:bool }]  (joined by image_ref upstream)
export function aggregateMarketPosition(records, { crowdedShare = 0.25 } = {}) {
  const total = records.length;
  // full grid, all cells 0
  const grid = {};
  for (const b of BENEFITS) { grid[b] = {}; for (const f of FUNNELS) grid[b][f] = 0; }
  const cellRecords = {}; // "b×f" -> records[]
  let dropped = 0;
  for (const r of records) {
    if (!BENEFITS.includes(r.benefit) || !FUNNELS.includes(r.funnel)) { dropped++; continue; }
    grid[r.benefit][r.funnel]++;
    const key = `${r.benefit}×${r.funnel}`;
    (cellRecords[key] ||= []).push(r);
  }

  // dominant = non-zero cells, count desc (stable by benefit then funnel enum order)
  const cells = [];
  for (const b of BENEFITS) for (const f of FUNNELS) if (grid[b][f] > 0) cells.push({ b, f, count: grid[b][f] });
  cells.sort((a, b) => b.count - a.count);
  const dominant_positions = cells.map(({ b, f, count }) => {
    const rs = cellRecords[`${b}×${f}`] || [];
    const pos = { position: `${b}×${f}`, count, share: round(total ? count / total : 0) };
    const ats = topValues(rs.map((r) => r.ad_type)); if (ats.length) pos.common_ad_types = ats;
    const ess = topValues(rs.map((r) => r.execution_style)); if (ess.length) pos.common_execution_styles = ess;
    const dvs = topValues(rs.flatMap((r) => r.devices || [])); if (dvs.length) pos.common_devices = dvs;
    return pos;
  });

  // crowded = a REAL position (excluding `unclear` axes) with share >= threshold
  const crowded_positions = dominant_positions
    .filter((p) => p.share >= crowdedShare && !p.position.includes("unclear"))
    .map((p) => ({ position: p.position, reason: `high observed frequency (${Math.round(p.share * 100)}% of corpus)` }));

  // whitespace = a REAL benefit×funnel cell (excluding the `unclear` axes) with 0 observed ads
  const whitespace_positions = [];
  for (const b of BENEFITS) for (const f of FUNNELS) {
    if (b === "unclear" || f === "unclear") continue;
    if (grid[b][f] === 0) whitespace_positions.push({ position: `${b}×${f}`, reason: "no observed ads in this position (low frequency; not a guaranteed opportunity)" });
  }

  // high reusability = cells with usable records → their abstract devices
  const high_reusability_patterns = [];
  for (const { b, f } of cells) {
    const rs = (cellRecords[`${b}×${f}`] || []).filter((r) => r.usable === true);
    if (!rs.length) continue;
    const devices = topValues(rs.flatMap((r) => r.devices || []));
    high_reusability_patterns.push({ position: `${b}×${f}`, devices, why_reusable: "abstract reusable devices observed in this position (template, not specific content)" });
  }

  // risks + coverage (no fake data; surface gaps)
  const unclearBenefit = records.filter((r) => r.benefit === "unclear").length;
  const risks = [];
  if (total > 0 && unclearBenefit / total >= 0.3) risks.push({ risk: "low-evidence corpus", reason: `${unclearBenefit}/${total} ads have an unclear benefit_vector` });
  if (total < 3) risks.push({ risk: "thin corpus", reason: `only ${total} ads — positions are low-confidence` });
  const coverage_flags = [];
  if (dropped) coverage_flags.push(`${dropped} record(s) had an out-of-vocab benefit/funnel and were skipped`);
  if (unclearBenefit) coverage_flags.push(`${unclearBenefit}/${total} ads: benefit_vector unclear`);

  const out = { total_ads: total, by_benefit_and_funnel: grid, dominant_positions, crowded_positions, whitespace_positions, high_reusability_patterns };
  if (risks.length) out.risks = risks;
  if (coverage_flags.length) out.coverage_flags = coverage_flags;
  return out;
}

// Join a strategy-projection + its ad-type classification into one position record.
export function toRecord(strategy, adType = {}) {
  return {
    benefit: strategy.benefit_vector && strategy.benefit_vector.primary,
    funnel: strategy.funnel_intent && strategy.funnel_intent.stage,
    ad_type: adType.ad_type,
    execution_style: adType.execution_style,
    devices: (strategy.generation_reusability && strategy.generation_reusability.reusable_devices) || [],
    usable: !!(strategy.generation_reusability && strategy.generation_reusability.usable),
  };
}

// CLI: node market-position-aggregate.mjs <records.json>  ([{benefit,funnel,...}]) → prints the matrix.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const [path] = process.argv.slice(2);
  if (!path) { console.error("Usage: node market-position-aggregate.mjs <records.json>"); process.exit(2); }
  console.log(JSON.stringify(aggregateMarketPosition(JSON.parse(readFileSync(path, "utf8"))), null, 2));
}
