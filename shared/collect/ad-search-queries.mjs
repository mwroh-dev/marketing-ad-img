// Pure, platform-agnostic ad-search query builder. Reuses the collection keyword-model (via
// scout-rank.deriveQueries) to produce relevant keyword queries, plus confirmed-competitor
// advertiser queries. The keyword STRATEGY is shared across platforms; only the per-platform
// search URL / extraction differs (see the platform adapters in each collector).
import { deriveQueries } from "./scout-rank.mjs";

export function buildAdQueries({ productCategory = "", keywordModel = null, competitors = [], maxKeyword = 5, maxAdvertiser = 5 } = {}) {
  const out = [];
  const seen = new Set();
  // keyword mode: group-combination queries from the keyword model (product_category × feature/target/benefit).
  const kq = deriveQueries({ productCategory, languageCues: [], seeds: [] }, keywordModel);
  for (const q of kq.slice(0, maxKeyword)) {
    if (q && !seen.has("k:" + q)) { seen.add("k:" + q); out.push({ mode: "keyword", query: q }); }
  }
  // advertiser mode: confirmed competitor names (precise — that brand's ads).
  for (const c of competitors.slice(0, maxAdvertiser)) {
    const name = typeof c === "string" ? c : (c && c.name);
    if (name && !seen.has("a:" + name)) { seen.add("a:" + name); out.push({ mode: "advertiser", query: name }); }
  }
  return out;
}
