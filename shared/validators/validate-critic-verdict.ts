// SHAPE sanity only — schema conformance. This does NOT verify the producing agent's logical
// correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agents/<name>/checklist.md. Shape-valid ≠ correct.

// Validates a critic-verdict artifact against the schema.
// Usage: tsx shared/validators/validate-critic-verdict.ts <path>
import { loadJson, validateAgainst, report } from "../_lib.ts";

const path = process.argv[2];
if (!path) { console.error("Usage: tsx shared/validators/validate-critic-verdict.ts <path>"); process.exit(2); }

const ok = report("critic-verdict", validateAgainst("critic-verdict.schema.json", loadJson(path)));
process.exit(ok ? 0 : 1);
