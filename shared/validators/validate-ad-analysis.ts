// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify the
// producing agent's logical correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agents/<name>/checklist.md. Shape-valid ≠ correct.

// Validates ad-analysis artifacts against their schemas. Validates ONLY the artifacts whose paths
// are passed — no fixture fallback. Pass the ones you have (any subset, in this slot order).
// Usage: tsx shared/validators/validate-ad-analysis.ts [--perception <path>] [--layout <path>] [--copy <path>] [--visual <path>] [--intent <path>] [--pattern <path>]
import { loadJson, validateAgainst, report } from "../_lib.ts";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

const perceptionPath = arg("--perception");
const layoutPath = arg("--layout");
const copyPath = arg("--copy");
const visualPath = arg("--visual");
const intentPath = arg("--intent");
const bindingsPath = arg("--bindings");
const adtypePath = arg("--adtype");
const strategyPath = arg("--strategy");
const marketposPath = arg("--marketpos");
const patternPath = arg("--pattern");

if (!perceptionPath && !layoutPath && !copyPath && !visualPath && !intentPath && !bindingsPath && !adtypePath && !strategyPath && !marketposPath && !patternPath) {
  console.error("Usage: tsx shared/validators/validate-ad-analysis.ts [--perception <path>] [--layout <path>] [--copy <path>] [--visual <path>] [--intent <path>] [--bindings <path>] [--adtype <path>] [--strategy <path>] [--marketpos <path>] [--pattern <path>] (at least one)");
  process.exit(2);
}

let ok = true;

// perception / visual / intent are one object per image. layout / copy are envelopes ({analyses:[...]}).
if (perceptionPath) ok = report("perception", validateAgainst("perception.schema.json", loadJson(perceptionPath))) && ok;

if (layoutPath) {
  const layout = loadJson<any>(layoutPath);
  for (const a of layout.analyses) ok = report(`layout-analysis ${a.image_ref}`, validateAgainst("layout-analysis.schema.json", a)) && ok;
}

if (copyPath) {
  const copy = loadJson<any>(copyPath);
  for (const a of copy.analyses) ok = report(`copy-analysis ${a.image_ref}`, validateAgainst("copy-analysis.schema.json", a)) && ok;
}

if (visualPath) ok = report("visual-analysis", validateAgainst("visual-analysis.schema.json", loadJson(visualPath))) && ok;

if (intentPath) ok = report("intent-analysis", validateAgainst("intent-analysis.schema.json", loadJson(intentPath))) && ok;

if (bindingsPath) ok = report("bindings", validateAgainst("bindings.schema.json", loadJson(bindingsPath))) && ok;

if (adtypePath) ok = report("ad-type", validateAgainst("ad-type.schema.json", loadJson(adtypePath))) && ok;

if (strategyPath) ok = report("strategy-projection", validateAgainst("strategy-projection.schema.json", loadJson(strategyPath))) && ok;

if (marketposPath) ok = report("market-position-matrix", validateAgainst("market-position-matrix.schema.json", loadJson(marketposPath))) && ok;

if (patternPath) ok = report("ad-pattern", validateAgainst("ad-pattern.schema.json", loadJson(patternPath))) && ok;

process.exit(ok ? 0 : 1);
