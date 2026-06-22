// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify the
// producing agent's logical correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agents/<name>/checklist.md. Shape-valid ≠ correct.

// Validates an ad-creative dataset against the schema.
// Usage: tsx scripts/validate-ad-creative.ts [path]
import { loadJson, validateAgainst, report } from "../_lib.ts";

const path = process.argv[2];
if (!path) { console.error("Usage: tsx shared/validators/validate-ad-creative.ts <path>"); process.exit(2); }
let ok = true;
const data = loadJson<any>(path);
ok = report("ad-creative", validateAgainst("ad-creative.schema.json", data)) && ok;

// Cross-check: every creative carries image_url OR video_url; report detail-capture coverage.
const list = Array.isArray((data as any).creatives) ? (data as any).creatives : [];
const withMedia = list.filter((c: any) => c.image_url || c.video_url).length;
if (list.length === withMedia) console.log(`PASS  ${list.length} creatives all have image_url or video_url`);
else { console.error(`FAIL  ${list.length - withMedia} creatives missing both image_url and video_url`); ok = false; }
const withDetail = list.filter((c: any) => c.detail_captured).length;
console.log(`INFO  detail_captured: ${withDetail}/${list.length}`);

process.exit(ok ? 0 : 1);
