// SHAPE sanity only — schema conformance + the total-accounting invariant. Does NOT verify the human's
// keep/delete judgement (reason:user_removed) nor the deterministic screen — those are the gate itself,
// not a schema concern. Both producers (human review, screen-images.mjs) write this same shape.

// Validates an image-screening artifact (+ checks total = kept + dropped).
// Usage: tsx shared/validators/validate-image-screening.ts <path>
import { loadJson, validateAgainst, report } from "../_lib.ts";

const path = process.argv[2];
if (!path) { console.error("Usage: tsx shared/validators/validate-image-screening.ts <path>"); process.exit(2); }

const data = loadJson<any>(path);
let ok = report("image-screening", validateAgainst("image-screening.schema.json", data));

const kept = Array.isArray(data?.kept) ? data.kept.length : 0;
const dropped = Array.isArray(data?.dropped) ? data.dropped.length : 0;
if (data?.total !== kept + dropped) {
  console.error(`FAIL  total accounting: total=${data?.total} but kept(${kept})+dropped(${dropped})=${kept + dropped} — silent omission`);
  ok = false;
} else {
  console.log(`PASS  total accounting (${data.total} = ${kept} kept + ${dropped} dropped)`);
}
process.exit(ok ? 0 : 1);
