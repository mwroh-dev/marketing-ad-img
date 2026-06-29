// Harness: compare two creative-snapshot artifacts.
// Usage: node shared/harness/compare-creative-snapshots.mjs <from_snapshot.json> <to_snapshot.json> [out.json]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { compareCreativeSnapshots } from "../collect/creative-diff.mjs";
import { validateAgainst, report } from "../collect/schema-validate.mjs";

const [fromPath, toPath, outArg] = process.argv.slice(2);
if (!fromPath || !toPath) {
  console.error("Usage: node shared/harness/compare-creative-snapshots.mjs <from_snapshot.json> <to_snapshot.json> [out.json]");
  process.exit(2);
}

const from = JSON.parse(readFileSync(resolve(fromPath), "utf8"));
const to = JSON.parse(readFileSync(resolve(toPath), "utf8"));
const diff = compareCreativeSnapshots(from, to, { generatedAt: new Date().toISOString() });
const outPath = resolve(outArg || resolve(dirname(toPath), "creative-diff.json"));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(diff, null, 2) + "\n", "utf8");
const ok = report("creative-diff written", validateAgainst("creative-diff.schema.json", diff));
console.log(`  → ${outPath}`);
process.exit(ok ? 0 : 1);
