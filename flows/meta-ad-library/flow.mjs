import { defineFlow } from "../../shared/collect/define-flow.mjs";

// Meta uses the public FILTER URL directly (the documented public-ad-transparency carve-out) — there is
// NO search-box/mouse interaction; the query is a URL parameter, and the assembled URL is still validated
// against the whitelisted public front-door by ad-collect-harness.goto → matchToolEntry. Per query `q`
// (q is RUNTIME input — never baked):
//   a. navigate   target: filter front-door + config params + q   action: ctx.goto (wait load + SPA settle)   → page | blocked → STOP
//   b. readCount  target: document.body innerText                 action: regex "<n> results"                 → coverage signal only
//   c. scroll     action: ctx.scroll ×5 (lazy-load creative images)                                            → DOM grows
//   d. capture    action: ctx.drain — harness keeps getResponseBody images matching imgMatch (fbcdn t39.35426) → creatives[]
export default defineFlow({
  name: "meta",
  source: "meta_ad_library",
  entrypoints: ["https://www.facebook.com/ads/library/"],
  acceptModes: ["keyword", "advertiser"],
  imgMatch: (u) => u.indexOf("t39.35426") > -1 && u.indexOf("scontent") > -1,   // fbcdn ad-creative image url
  // filter parameters as NAMED CONFIG (not literals in collect); `q` is always the runtime value
  config: { active_status: "active", ad_type: "all", country: "KR", media_type: "image", search_type: "keyword_unordered", maxScroll: 5 },
  filterUrl(query) { return `https://www.facebook.com/ads/library/?${new URLSearchParams({ ...this.config, q: query })}`; },

  async collect(ctx) {                       // steps a–d per the FLOW header above
    for (const { query: q } of ctx.queries) {
      if (ctx.limitReached()) break;
      ctx.resetBuffer();
      if (!(await ctx.goto(this.filterUrl(q)))) { ctx.flag(`blocked: ${q}`); break; }
      const m = (await ctx.evalJs("document.body.innerText.slice(0,5000)")).match(/~?\s*([0-9,]+)\s*results/i);
      ctx.flag(`"${q}": ${m ? m[1] : "?"} results`);
      await ctx.scroll(this.config.maxScroll);
      await ctx.drain();
    }
  },
});
