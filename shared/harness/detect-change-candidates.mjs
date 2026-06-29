// Harness: turn a creative-diff artifact into deterministic change candidates.
// Usage: node shared/harness/detect-change-candidates.mjs <creative-diff.json> [out.json]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { detectChangeCandidates } from "../collect/change-candidates.mjs";
import { validateAgainst, report } from "../collect/schema-validate.mjs";

const [diffPath, outArg] = process.argv.slice(2);
if (!diffPath) {
  console.error("Usage: node shared/harness/detect-change-candidates.mjs <creative-diff.json> [out.json]");
  process.exit(2);
}

const diff = JSON.parse(readFileSync(resolve(diffPath), "utf8"));
const out = { ...detectChangeCandidates(diff), generated_at: new Date().toISOString() };
const outPath = resolve(outArg || resolve(dirname(diffPath), "change-candidates.json"));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
const ok = report("change-candidates written", validateAgainst("change-candidate.schema.json", out));
console.log(`  → ${outPath} (${out.candidates.length} candidates)`);
process.exit(ok ? 0 : 1);
