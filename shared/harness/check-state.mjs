// Entry state-check for the orchestrator's state-first routing. Reads consumer state
// (.generate-ads-img/) and reports what is already set up, so the orchestrator routes (initial-setup vs a
// downstream mode) WITHOUT pre-reading the repo. Deterministic, no LLM. Cheap — one directory walk.
//
// Usage: node shared/harness/check-state.mjs   →   prints state status + ROUTE recommendation
import { readdirSync, existsSync, readFileSync } from "node:fs";
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

  // Per-run progress (resumability): walk runs/*/run.json so a returning user sees exactly how far each
  // collection run got (collected → human_reviewed → screened → analyzed) — no more "files exist but where
  // was I?". Reuses the missing-dir-safe `ls`; mirrors the runs/ walk in run-competitive-trend.ts.
  const runsDir = resolve(stateDir, "runs");
  const runs = ls(runsDir).filter((e) => e.isDirectory()).map((d) => {
    const rp = resolve(runsDir, d.name, "run.json");
    if (!existsSync(rp)) return { run_id: d.name, stage: "no_manifest" };
    try {
      const m = JSON.parse(readFileSync(rp, "utf8"));
      return { run_id: m.run_id ?? d.name, source: m.source, track: m.track, persona_id: m.persona_id, stage: m.stage, counts: m.counts };
    } catch { return { run_id: d.name, stage: "unreadable" }; }
  });
  // The "next" step the orchestrator should take, by state — NOT "read everything".
  const next = !setup_complete
    ? "initial-setup"
    : personas.some((x) => !x.has_competitors)
      ? "ready — request-evaluation (note: some personas have no confirmed competitors)"
      : "ready — request-evaluation";

  return { state_dir: stateDir, has_state: existsSync(stateDir), brands, setup_complete, next, runs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = checkState();
  console.log(JSON.stringify(s, null, 2));
  console.log(`\nROUTE → ${s.next}`);
  const pending = (s.runs || []).filter((r) => r.stage && !["analyzed", "no_manifest", "unreadable"].includes(r.stage));
  if (pending.length) {
    console.log(`\nRUNS IN PROGRESS:`);
    for (const r of pending) console.log(`  ${r.run_id} — stage=${r.stage} (collected=${r.counts?.collected ?? "?"})`);
  }
}
