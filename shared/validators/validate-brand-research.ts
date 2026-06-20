// SHAPE sanity only — schema conformance. This does NOT verify the producing agent's logical
// correctness (evidence-grounded, no fabrication); that is the LOGICAL gate in
// agents/brand-researcher.md checklist. Shape-valid ≠ correct.

// Validates a brand-research findings artifact against the schema.
// Usage: tsx shared/validators/validate-brand-research.ts <path>
import { loadJson, validateAgainst, report } from "../_lib.ts";

const path = process.argv[2];
if (!path) { console.error("Usage: tsx shared/validators/validate-brand-research.ts <path>"); process.exit(2); }

const ok = report("brand-research", validateAgainst("brand-research.schema.json", loadJson(path)));
process.exit(ok ? 0 : 1);
