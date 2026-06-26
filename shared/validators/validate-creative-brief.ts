// SHAPE sanity only — schema conformance. This does NOT verify the producing agent's logical
// correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agent's `## Verification checklist` section. Shape-valid ≠ correct.

// Validates a creative-brief artifact against the schema.
// Usage: tsx shared/validators/validate-creative-brief.ts <path>
import { loadJson, validateAgainst, report } from "../_lib.ts";

const path = process.argv[2];
if (!path) { console.error("Usage: tsx shared/validators/validate-creative-brief.ts <path>"); process.exit(2); }

const ok = report("creative-brief", validateAgainst("creative-brief.schema.json", loadJson(path)));
process.exit(ok ? 0 : 1);
