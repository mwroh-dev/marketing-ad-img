// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify the
// producing agent's logical correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agent's `## Verification checklist` section. Shape-valid ≠ correct.

// Validates a request-evaluation artifact against request-evaluation.schema.json.
// Usage: tsx scripts/validate-request-evaluation.ts [path]
import { loadJson, validateAgainst, report } from "../_lib.ts";

const path = process.argv[2] ?? ".generate-ads-img/runs/mock-image-generation/request-evaluation/request-evaluation.json";
const data = loadJson<any>(path);
const ok = report(`request-evaluation (${path})`, validateAgainst("request-evaluation.schema.json", data));
process.exit(ok ? 0 : 1);
