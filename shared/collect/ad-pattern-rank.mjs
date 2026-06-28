// Pure, deterministic aggregation for per-persona ad-pattern. No LLM, no network.
function round(n, p = 1e6) { return Math.round(n * p) / p; }

export function rankByFreq(values, k = 10) {
  const counts = new Map();
  const order = [];
  for (const v of values) {
    if (!counts.has(v)) { counts.set(v, 0); order.push(v); }
    counts.set(v, counts.get(v) + 1);
  }
  const total = values.length || 1;
  return order
    .map((v, i) => ({ value: v, freq: counts.get(v), score: round(counts.get(v) / total), _i: i }))
    .sort((a, b) => b.freq - a.freq || a._i - b._i)
    .slice(0, k)
    .map(({ _i, ...rest }) => rest);
}

// Longevity-weighted rank: like rankByFreq but each item carries a weight; values are ranked by weight-SHARE
// (a single long-lived ad can outrank a frequent-but-short-lived value). Emits the same {value,freq,score}
// shape (freq = raw count, score = weight-share) so it stays ad-pattern.schema compatible.
export function rankWeighted(items, valueOf, weightOf, k = 10) {
  const agg = new Map(); const order = [];
  let totalW = 0;
  for (const it of items) {
    const v = valueOf(it);
    if (v == null) continue;
    const w = weightOf(it);
    if (!agg.has(v)) { agg.set(v, { freq: 0, weight: 0 }); order.push(v); }
    const e = agg.get(v); e.freq += 1; e.weight += w; totalW += w;
  }
  totalW = totalW || 1;
  return order
    .map((v, i) => ({ value: v, freq: agg.get(v).freq, score: round(agg.get(v).weight / totalW), _i: i }))
    .sort((a, b) => b.score - a.score || a._i - b._i)
    .slice(0, k)
    .map(({ _i, ...rest }) => rest);
}

function daysBetween(a, b) { const d = (new Date(b) - new Date(a)) / 86400000; return Number.isFinite(d) ? Math.round(d) : null; }

// Build per-image longevity weights from collected creatives, keyed by image FILENAME (the join key to an
// analysis's image_ref). weight = 1 + running_days/halfLife. PARTIAL COVERAGE BY DESIGN: a creative with no
// `started_at` (Meta only populates it on detail-captured ads) gets the neutral weight 1 — never dropped,
// never zero-weighted (silent zero would erase short-lived OR uncaptured ads). `today` is injected (testable).
export function longevityWeights(creatives, today, { halfLifeDays = 90 } = {}) {
  const map = {};
  for (const c of creatives || []) {
    if (!c.image_file) continue;
    const key = String(c.image_file).split("/").pop();
    let w = 1;
    if (c.started_at) { const d = daysBetween(c.started_at, today); if (d != null && d >= 0) w = 1 + d / halfLifeDays; }
    map[key] = w;
  }
  return map;
}

// weightOf factory: (analysis) → weight, joining an analysis.image_ref to the longevity weight map by filename.
export function weightByImageRef(weights) {
  return (a) => weights[String(a.image_ref || "").split("/").pop()] ?? 1;
}

export function roleDistribution(copyAnalyses) {
  const d = {};
  for (const c of copyAnalyses) for (const e of c.copy_elements || []) d[e.text_role] = (d[e.text_role] || 0) + 1;
  return d;
}

export function comfortStats(layoutAnalyses) {
  const n = layoutAnalyses.length || 1;
  let crowd = 0, ws = 0, awk = 0;
  for (const l of layoutAnalyses) {
    crowd += (l.comfort && l.comfort.crowding) || 0;
    ws += l.whitespace_ratio || 0;
    if (l.comfort && l.comfort.awkward_placement) awk++;
  }
  return { avg_crowding: round(crowd / n, 100), avg_whitespace: round(ws / n, 100), awkward_rate: round(awk / n) };
}

export function aggregatePattern({ layoutAnalyses, copyAnalyses, visualAnalyses = [], intentAnalyses = [], weightOf = null }, k = 10) {
  const hooks = copyAnalyses.flatMap((c) => (c.copy_elements || []).map((e) => e.hook_type).filter(Boolean));
  const keywords = copyAnalyses.flatMap((c) => c.keywords || []);
  // Single-value-per-image axes: longevity-weighted when `weightOf` supplied (Phase 6), else plain frequency.
  // (The flatMapped axes — hooks/keywords — stay frequency-only: one item yields many values, so per-item
  // longevity weighting is not well-defined there.)
  const rv = (items, valueOf) => weightOf ? rankWeighted(items, valueOf, weightOf, k) : rankByFreq(items.map(valueOf).filter((x) => x != null), k);
  const pattern = {
    image_count: layoutAnalyses.length,
    composition_top_k: rv(layoutAnalyses, (l) => l.composition_type),
    text_role_distribution: roleDistribution(copyAnalyses),
    hook_top_k: rankByFreq(hooks, k),
    copy_keywords_top_k: rankByFreq(keywords, k),
    comfort: comfortStats(layoutAnalyses),
  };
  // Visual axis aggregates (axes 3-4) — present only when visual analyses were supplied; each enum filtered for
  // absent values so an omitted (e.g. photo-only) field never becomes a phantom `undefined` bucket.
  if (visualAnalyses.length) {
    pattern.medium_top_k = rv(visualAnalyses, (v) => v.medium);
    pattern.setting_top_k = rv(visualAnalyses, (v) => v.scene_class && v.scene_class.setting);
    pattern.register_top_k = rv(visualAnalyses, (v) => v.register);
  }
  // Intent axis aggregates (axis 5) — the transferable strategy layer.
  if (intentAnalyses.length) {
    pattern.appeal_top_k = rv(intentAnalyses, (i) => i.appeal);
    pattern.funnel_stage_top_k = rv(intentAnalyses, (i) => i.funnel_stage);
  }
  return pattern;
}
