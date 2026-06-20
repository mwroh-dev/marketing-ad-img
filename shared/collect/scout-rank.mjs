// Pure, deterministic helpers for scout/curator. No network, no CDP.
export function deriveQueries({ productCategory = "", languageCues = [], seeds = [] }, keywordModel = null) {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    const v = String(raw).trim();
    if (!v || seen.has(v)) return;
    seen.add(v); out.push(v);
  };
  if (keywordModel && Array.isArray(keywordModel.groups)) {
    // Build queries from group-top keywords: product-type × (feature|audience|benefit).
    const top = (slot, n) => (keywordModel.groups.find((g) => g.slot === slot)?.keywords || [])
      .slice(0, n).map((k) => k.canonical);
    const products = top("product_category", 2);
    const modifiers = [...top("feature", 2), ...top("target", 1), ...top("benefit", 1)];
    for (const p of products) {
      push(p);
      for (const m of modifiers) push(`${p} ${m}`);
    }
    for (const s of seeds) push(s);
    return out.slice(0, 8);
  }
  // Cold-start: no model yet — category + seeds + cues.
  push(productCategory);
  for (const s of seeds) push(s);
  for (const c of languageCues) push(c);
  return out;
}

export function normalizeTitle(s) {
  return String(s).toLowerCase().replace(/[\s\-_!.,/]+/g, "");
}

export function dedupeCandidates(cands) {
  const seen = new Set();
  const out = [];
  for (const c of cands) {
    const key = normalizeTitle(c.name);
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
  }
  return out;
}

export function scorePersonaFit(candidate, persona) {
  const hay = `${candidate.name || ""} ${candidate.snippet || ""}`.toLowerCase();
  let n = 0;
  for (const cue of persona.language_cues || []) {
    if (cue && hay.includes(String(cue).toLowerCase())) n++;
  }
  return n;
}

export function rankCandidates(cands, persona) {
  return cands
    .map((c, i) => ({ c, i, s: scorePersonaFit(c, persona) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}
