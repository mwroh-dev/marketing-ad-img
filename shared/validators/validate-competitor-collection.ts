// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify the
// producing agent's logical correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agents/<name>/checklist.md. Shape-valid ≠ correct.

// Validates a store deep-collection output (products + detail-cut images + reviews).
// This is the CORRECT gate for the collection deliverable — distinct from validate-competitor.ts,
// which validates the discovery POOL (competitor-candidate.schema) and (by design) REJECTS the
// image_files/reviews fields that this collection MUST contain. Wiring validate-competitor.ts to
// collection was a done-registry mis-wiring; this validator locks the real collection contract.
// Usage: tsx scripts/validate-competitor-collection.ts <competitor-collection.json>
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadJson, validateAgainst, report, ROOT } from "../_lib.ts";

const path = process.argv[2];
if (!path) { console.error("Usage: tsx shared/validators/validate-competitor-collection.ts <competitor-collection.json>"); process.exit(2); }
let ok = true;
const data = loadJson<any>(path);

ok = report("competitor-collection", validateAgainst("competitor-collection.schema.json", data)) && ok;

const products: any[] = Array.isArray(data.products) ? data.products : [];

// collected count is honest
if (data.collected === products.length) console.log(`PASS  collected matches products[] (${products.length})`);
else { console.error(`FAIL  collected=${data.collected} != products[]=${products.length}`); ok = false; }

// each product carries >=1 REAL detail-cut image file that exists on disk (no-smoke: real bytes)
let withRealImg = 0;
for (const p of products) {
  const files: string[] = Array.isArray(p.image_files) ? p.image_files : [];
  const exists = files.filter((f) => existsSync(resolve(ROOT, f)));
  if (exists.length >= 1) withRealImg++;
  else console.error(`        - product idx=${p.idx} "${(p.title || "").slice(0, 24)}" has no on-disk image_files`);
}
if (products.length > 0 && withRealImg === products.length) console.log(`PASS  every product has >=1 real on-disk image (${withRealImg}/${products.length})`);
else { console.error(`FAIL  ${products.length - withRealImg} products missing real image files`); ok = false; }

// provenance: reached via a public ad-transparency library (Meta Ad Library / Google Ads Transparency),
// real search→click on the public front door — not an arbitrary host, no third-party-store scraping
const adLibHosts = products.filter((p) => /facebook\.com\/ads\/library|adstransparency\.google|ads\.google|meta_ad_library|google_ads_transparency/i.test(p.host || ""));
if (products.length > 0 && adLibHosts.length === products.length) console.log("PASS  all products from a public ad-library host (search-click provenance)");
else { console.error(`FAIL  ${products.length - adLibHosts.length} products from non-ad-library host`); ok = false; }

// credential-free: no cookie/token/password/session field anywhere (CLAUDE.md hard rule)
const blob = JSON.stringify(data);
if (/"(cookie|set-cookie|token|password|sessionid|session_id|auth_token|access_token)"\s*:/i.test(blob)) {
  console.error("FAIL  credential-like field present in artifact (must be credential-free)"); ok = false;
} else console.log("PASS  credential-free");

process.exit(ok ? 0 : 1);
