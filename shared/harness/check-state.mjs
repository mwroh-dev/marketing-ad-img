// Entry state-check for the orchestrator's state-first routing. Reads consumer state
// (.generate-ads-img/) and reports what is already set up, so the orchestrator routes (initial-setup vs a
// downstream mode) WITHOUT pre-reading the repo. Deterministic, no LLM. Cheap — one directory walk.
//
// Usage: node shared/harness/check-state.mjs   →   prints state status + ROUTE recommendation
import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const STATE_DIR = resolve(process.env.GEN_ADS_IMG_STATE ?? resolve(process.cwd(), ".generate-ads-img"));

const ls = (p) => { try { return readdirSync(p, { withFileTypes: true }); } catch { return []; } };

export function checkState(stateDir = STATE_DIR) {
  const brandsDir = resolve(stateDir, "brands");
  const brands = ls(brandsDir).filter((e) => e.isDirectory()).map((b) => {
    const bdir = resolve(brandsDir, b.name);
    const products = ls(resolve(bdir, "products")).filter((e) => e.isDirectory()).map((p) => {
      const pdir = resolve(bdir, "products", p.name, "personas");
      const seen = new Set();
      const personas = ls(pdir)
        .map((e) => e.name.replace(/\.json$/, ""))
        .filter((name) => (seen.has(name) ? false : (seen.add(name), true)))
        .map((name) => {
          const pd = resolve(pdir, name);
          return {
            persona_id: name,
            has_competitors: existsSync(resolve(pd, "competitors", "competitors.json")) || existsSync(resolve(pd, "competitors.json")),
            has_collected_ads: existsSync(resolve(pd, "creative-history")) || existsSync(resolve(pd, "ad-creatives")),
            has_ad_pattern: existsSync(resolve(pd, "ad-pattern.json")),
          };
        });
      return { product_id: p.name, personas };
    });
    return { brand_id: b.name, products };
  });

  const personas = brands.flatMap((b) => b.products.flatMap((p) => p.personas));
  const setup_complete = personas.length > 0;
  // The "next" step the orchestrator should take, by state — NOT "read everything".
  const next = !setup_complete
    ? "initial-setup"
    : personas.some((x) => !x.has_competitors)
      ? "ready — request-evaluation (note: some personas have no confirmed competitors)"
      : "ready — request-evaluation";

  return { state_dir: stateDir, has_state: existsSync(stateDir), brands, setup_complete, next };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = checkState();
  console.log(JSON.stringify(s, null, 2));
  console.log(`\nROUTE → ${s.next}`);
}
