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

export function aggregatePattern({ layoutAnalyses, copyAnalyses }, k = 10) {
  const hooks = copyAnalyses.flatMap((c) => (c.copy_elements || []).map((e) => e.hook_type).filter(Boolean));
  const keywords = copyAnalyses.flatMap((c) => c.keywords || []);
  return {
    image_count: layoutAnalyses.length,
    composition_top_k: rankByFreq(layoutAnalyses.map((l) => l.composition_type), k),
    text_role_distribution: roleDistribution(copyAnalyses),
    hook_top_k: rankByFreq(hooks, k),
    copy_keywords_top_k: rankByFreq(keywords, k),
    comfort: comfortStats(layoutAnalyses),
  };
}
