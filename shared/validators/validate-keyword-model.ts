// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify logical
// correctness (right slot, loanword normalization, no invention). The LOGICAL gate is
// agents/ad-analyst/checklist.md.
// Usage: tsx shared/validators/validate-keyword-model.ts <instancesPath> [modelPath]
import { loadJson, validateAgainst, report } from "../_lib.ts";

const instancesPath = process.argv[2];
if (!instancesPath) { console.error("Usage: tsx shared/validators/validate-keyword-model.ts <instancesPath> [modelPath]"); process.exit(2); }
const modelPath = process.argv[3];

let ok = true;
const instances = loadJson<any>(instancesPath);
ok = report("keyword-instances", validateAgainst("keyword-instance.schema.json", instances)) && ok;

// (slot-enum membership is enforced by keyword-instance.schema.json — not re-checked here.)

if (modelPath) {
  const model = loadJson<any>(modelPath);
  ok = report("keyword-model", validateAgainst("keyword-model.schema.json", model)) && ok;
  // ranking sanity: within each group, scores are non-increasing.
  for (const g of model.groups) {
    for (let i = 1; i < g.keywords.length; i++) {
      if (g.keywords[i].score > g.keywords[i - 1].score) { console.error(`FAIL  ${g.slot} not score-sorted`); ok = false; break; }
    }
  }
  if (ok) console.log("PASS  groups are score-sorted");
}

process.exit(ok ? 0 : 1);
