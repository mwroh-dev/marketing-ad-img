// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify the
// producing agent's logical correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agent's `## Verification checklist` section. Shape-valid ≠ correct.

// Validates ad-analysis artifacts against their schemas. Validates ONLY the artifacts whose paths
// are passed — no fixture fallback. Pass the ones you have (any subset, in this slot order).
// Usage: tsx shared/validators/validate-ad-analysis.ts [--perception <path>] [--layout <path>] [--copy <path>] [--visual <path>] [--intent <path>] [--pattern <path>] [...]
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
const adtypeGatePath = arg("--adtype-gate");
const strategyPath = arg("--strategy");
const marketposPath = arg("--marketpos");
const opportunityPath = arg("--opportunity");
const patternPath = arg("--pattern");
const creativeSnapshotPath = arg("--creative-snapshot");
const creativeDiffPath = arg("--creative-diff");
const changeCandidatePath = arg("--change-candidate");
const contextCalendarPath = arg("--context-calendar");
const interpretedChangeEventPath = arg("--interpreted-change-event");
const creativeChangeReportPath = arg("--creative-change-report");

if (!perceptionPath && !layoutPath && !copyPath && !visualPath && !intentPath && !bindingsPath && !adtypePath && !adtypeGatePath && !strategyPath && !marketposPath && !opportunityPath && !patternPath && !creativeSnapshotPath && !creativeDiffPath && !changeCandidatePath && !contextCalendarPath && !interpretedChangeEventPath && !creativeChangeReportPath) {
  console.error("Usage: tsx shared/validators/validate-ad-analysis.ts [--perception <path>] [--layout <path>] [--copy <path>] [--visual <path>] [--intent <path>] [--bindings <path>] [--adtype <path>] [--adtype-gate <path>] [--strategy <path>] [--marketpos <path>] [--opportunity <path>] [--pattern <path>] [--creative-snapshot <path>] [--creative-diff <path>] [--change-candidate <path>] [--context-calendar <path>] [--interpreted-change-event <path>] [--creative-change-report <path>] (at least one)");
  process.exit(2);
}

let ok = true;

// perception / visual / intent are one object per image. layout / copy are envelopes ({analyses:[...]}).
if (perceptionPath) ok = report("perception", validateAgainst("perception.schema.json", loadJson(perceptionPath))) && ok;

// copy/layout are emitted as single per-image objects, AND collected into {analyses:[...]} envelopes for
// aggregation. Accept EITHER shape (envelope → validate each; single object → validate it directly).
function items(loaded: any): any[] {
  return Array.isArray(loaded?.analyses) ? loaded.analyses : [loaded];
}

if (layoutPath) {
  for (const a of items(loadJson<any>(layoutPath))) ok = report(`layout-analysis ${a.image_ref ?? ""}`, validateAgainst("layout-analysis.schema.json", a)) && ok;
}

if (copyPath) {
  for (const a of items(loadJson<any>(copyPath))) ok = report(`copy-analysis ${a.image_ref ?? ""}`, validateAgainst("copy-analysis.schema.json", a)) && ok;
}

if (visualPath) ok = report("visual-analysis", validateAgainst("visual-analysis.schema.json", loadJson(visualPath))) && ok;

if (intentPath) ok = report("intent-analysis", validateAgainst("intent-analysis.schema.json", loadJson(intentPath))) && ok;

if (bindingsPath) ok = report("bindings", validateAgainst("bindings.schema.json", loadJson(bindingsPath))) && ok;

if (adtypePath) ok = report("ad-type", validateAgainst("ad-type.schema.json", loadJson(adtypePath))) && ok;

if (adtypeGatePath) ok = report("ad-type-gate", validateAgainst("ad-type-gate.schema.json", loadJson(adtypeGatePath))) && ok;

if (strategyPath) ok = report("strategy-projection", validateAgainst("strategy-projection.schema.json", loadJson(strategyPath))) && ok;

if (marketposPath) ok = report("market-position-matrix", validateAgainst("market-position-matrix.schema.json", loadJson(marketposPath))) && ok;

if (opportunityPath) ok = report("creative-opportunity", validateAgainst("creative-opportunity.schema.json", loadJson(opportunityPath))) && ok;

if (patternPath) ok = report("ad-pattern", validateAgainst("ad-pattern.schema.json", loadJson(patternPath))) && ok;

if (creativeSnapshotPath) ok = report("creative-snapshot", validateAgainst("creative-snapshot.schema.json", loadJson(creativeSnapshotPath))) && ok;

if (creativeDiffPath) ok = report("creative-diff", validateAgainst("creative-diff.schema.json", loadJson(creativeDiffPath))) && ok;

if (changeCandidatePath) ok = report("change-candidate", validateAgainst("change-candidate.schema.json", loadJson(changeCandidatePath))) && ok;

if (contextCalendarPath) ok = report("context-calendar", validateAgainst("context-calendar.schema.json", loadJson(contextCalendarPath))) && ok;

if (interpretedChangeEventPath) ok = report("interpreted-change-event", validateAgainst("interpreted-change-event.schema.json", loadJson(interpretedChangeEventPath))) && ok;

if (creativeChangeReportPath) ok = report("creative-change-report", validateAgainst("creative-change-report.schema.json", loadJson(creativeChangeReportPath))) && ok;

process.exit(ok ? 0 : 1);
