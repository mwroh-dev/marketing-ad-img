// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify the
// producing agent's logical correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agents/<name>/checklist.md. Shape-valid ≠ correct.

// Validates discovery-scout pool + curator confirmed-set against schemas.
// Usage: tsx scripts/validate-competitor.ts [candidatesPath] [confirmedPath]
import { loadJson, validateAgainst, report } from "../_lib.ts";

const candidatesPath = process.argv[2];
const confirmedPath = process.argv[3];
if (!candidatesPath || !confirmedPath) { console.error("Usage: tsx shared/validators/validate-competitor.ts <candidatesPath> <confirmedPath>"); process.exit(2); }

let ok = true;
const pool = loadJson<any>(candidatesPath);
const confirmed = loadJson<any>(confirmedPath);

ok = report("competitor-candidate pool", validateAgainst("competitor-candidate.schema.json", pool)) && ok;
ok = report("competitor confirmed set", validateAgainst("competitor.schema.json", confirmed)) && ok;

// Cross-checks: scout did NOT deep-collect (no review/image fields leaked into pool).
const leaked = pool.candidates.find((c: any) => "reviews" in c || "image_files" in c);
if (leaked) { console.error(`FAIL  scout pool leaked deep-collected fields: ${leaked.name}`); ok = false; }
else console.log("PASS  scout pool is search-only (no reviews/images)");

// Cross-check: confirmed competitors trace to the same persona as the pool.
if (confirmed.persona_id !== pool.persona_id) { console.error(`FAIL  persona mismatch pool=${pool.persona_id} confirmed=${confirmed.persona_id}`); ok = false; }
else console.log(`PASS  persona consistent (${pool.persona_id})`);

process.exit(ok ? 0 : 1);
