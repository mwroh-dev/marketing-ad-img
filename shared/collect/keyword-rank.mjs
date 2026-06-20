// Pure, deterministic keyword scoring/ranking. No network, no LLM.
export function countOccurrences(text, canonical, variants = []) {
  const hay = String(text || "").toLowerCase();
  let n = 0;
  const seen = new Set();
  for (const form of [canonical, ...variants]) {
    const needle = String(form).toLowerCase();
    if (!needle || seen.has(needle)) continue;
    seen.add(needle);
    let i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  }
  return n;
}

export function computeStats(instances, corpus) {
  const docs = (corpus && corpus.docs) || [];
  return instances.map((it) => {
    let tf = 0;
    const hit = new Set();
    for (const d of docs) {
      const t = countOccurrences(d.title, it.canonical, it.variants);
      const de = countOccurrences(d.detail, it.canonical, it.variants);
      tf += t * 2 + de;                       // title weighted ×2
      if (t + de > 0) hit.add(d.competitor_id);
    }
    return { canonical: it.canonical, variants: it.variants || [], slot: it.slot,
             english_origin: !!it.english_origin, tf, df: hit.size };
  });
}

export function scoreKeywords(stats, persona, competitorCount, weights = { tf: 0.4, df: 0.4, cue: 0.2 }) {
  const cues = ((persona && persona.language_cues) || []).map((c) => String(c).toLowerCase());
  const maxTf = Math.max(1, ...stats.map((s) => s.tf));
  const denomDf = Math.max(1, competitorCount);
  return stats.map((s) => {
    const forms = [s.canonical, ...(s.variants || [])].map((f) => String(f).toLowerCase());
    const cue_match = cues.some((cue) => forms.some((f) => f.includes(cue) || cue.includes(f))) ? 1 : 0;
    const score = weights.tf * (s.tf / maxTf) + weights.df * (s.df / denomDf) + weights.cue * cue_match;
    return { ...s, cue_match, score: Math.round(score * 1e6) / 1e6 };
  });
}

export function rankByGroup(scored, k = 10) {
  const groups = {};
  scored.forEach((s, i) => { (groups[s.slot] ||= []).push({ ...s, _i: i }); });
  return Object.keys(groups).map((slot) => ({
    slot,
    keywords: groups[slot]
      .sort((a, b) => b.score - a.score || a._i - b._i)
      .slice(0, k)
      .map(({ _i, ...rest }) => rest),
  }));
}
