// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify the
// producing agent's logical correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agents/<name>/checklist.md. Shape-valid ≠ correct.

// Validates ad-analysis artifacts against their schemas. Validates ONLY the artifacts whose paths
// are passed — no fixture fallback. Pass the ones you have (any subset, in this slot order).
// Usage: tsx shared/validators/validate-ad-analysis.ts [--ocr <path>] [--layout <path>] [--copy <path>] [--pattern <path>]
import { loadJson, validateAgainst, report } from "../_lib.ts";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

const ocrPath = arg("--ocr");
const layoutPath = arg("--layout");
const copyPath = arg("--copy");
const patternPath = arg("--pattern");

if (!ocrPath && !layoutPath && !copyPath && !patternPath) {
  console.error("Usage: tsx shared/validators/validate-ad-analysis.ts [--ocr <path>] [--layout <path>] [--copy <path>] [--pattern <path>] (at least one)");
  process.exit(2);
}

let ok = true;

if (ocrPath) ok = report("ocr-extraction", validateAgainst("ocr-extraction.schema.json", loadJson(ocrPath))) && ok;

if (layoutPath) {
  const layout = loadJson<any>(layoutPath);
  for (const a of layout.analyses) ok = report(`layout-analysis ${a.image_ref}`, validateAgainst("layout-analysis.schema.json", a)) && ok;
}

if (copyPath) {
  const copy = loadJson<any>(copyPath);
  for (const a of copy.analyses) ok = report(`copy-analysis ${a.image_ref}`, validateAgainst("copy-analysis.schema.json", a)) && ok;
}

if (patternPath) ok = report("ad-pattern", validateAgainst("ad-pattern.schema.json", loadJson(patternPath))) && ok;

process.exit(ok ? 0 : 1);
