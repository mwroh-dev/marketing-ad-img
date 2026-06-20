import { defineFlow } from "../../shared/collect/define-flow.mjs";
import { parseAdvertiserId, chooseAdvertiser } from "../../shared/collect/ad-source-helpers.mjs";

// Google search returns ADVERTISER suggestions only (no topical results page), so we type the name,
// hover-click the best-matching suggestion, land on /advertiser/AR<id>, collect its image creatives.
// Per advertiser `name` (runtime input; never baked). Interaction mechanics live in the shared ctx
// primitives; the per-step detail — target selector · action · how the mouse accesses · wait:
//   a. openHome  target adstransparency.google.com/?region=<cfg.region>  action ctx.goto  wait Angular SPA + search <input>  → page | blocked → STOP
//   b. typeName  target cfg.searchSel  action ctx.type = focus(sel) + Input.insertText(name) [Hangul-safe, not DOM injection]  wait ~3s autocomplete
//   c. suggest   target cfg.suggestionSel (material-select-item[role=option])  action ctx.suggestions poll ≤6s  → [{text, x, y}] bbox centers
//   d. match     action chooseAdvertiser(name) exact>prefix>loose  → picked | null (no_advertiser_match, skip — NEVER blind-click first; "토스"≠"파낙토스")
//   e. open      target picked option bbox center  action ctx.clickAt = HOVER(mouseMoved, REQUIRED for Angular Material) + press/release  wait 7s JS nav  → /advertiser/AR<id>
//   f. capture   action ctx.scroll ×4 → ctx.drain keeps tpc.googlesyndication simgad responses w/ advertiser provenance  → creatives[]
export default defineFlow({
  name: "google",
  source: "google_ads_transparency",
  entrypoints: ["https://adstransparency.google.com/"],
  acceptModes: ["advertiser"],
  imgMatch: (u) => /tpc\.googlesyndication\.com\/archive\/simgad/.test(u),   // google ad-creative image url
  // named config (selectors + region — not literals in collect); the advertiser name is the runtime input
  config: { region: "KR", searchSel: "input[type=text]", suggestionSel: "material-select-item[role=option]", maxScroll: 4 },
  homeUrl() { return `https://adstransparency.google.com/?region=${this.config.region}`; },

  async collect(ctx) {                       // steps a–f per the FLOW header above
    for (const { query: name } of ctx.queries) {
      if (ctx.limitReached()) break;
      ctx.resetBuffer();
      if (!(await ctx.goto(this.homeUrl()))) { ctx.flag(`blocked: ${name}`); break; }
      await ctx.type(name, { selector: this.config.searchSel });
      const sugg = await ctx.suggestions(this.config.suggestionSel);
      const picked = chooseAdvertiser(sugg, name);
      if (!picked) { ctx.flag(`no_advertiser_match: ${name}`); continue; }
      await ctx.clickAt(sugg[picked.index].x, sugg[picked.index].y);
      const advId = parseAdvertiserId(await ctx.evalJs("location.href"));
      if (!advId) { ctx.flag(`no_nav_after_click: ${name} → ${picked.name} (${picked.quality})`); continue; }
      await ctx.scroll(this.config.maxScroll);
      await ctx.drain({ advertiser_id: advId, resolved_via: picked.quality === "loose" ? "advertiser_loose" : "advertiser", matched_name: picked.name, match_quality: picked.quality });
      ctx.flag(`"${name}" → ${picked.name} (${picked.quality}) ${advId}`);
    }
  },
});
