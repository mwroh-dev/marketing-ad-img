// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify the
// producing agent's logical correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agents/<name>/checklist.md. Shape-valid ≠ correct.

// Validates the image-generation run output against schemas AND cross-checks that the
// exact Korean copy is byte-identical across candidate spec -> both adapter outputs.
// Usage: tsx scripts/validate-candidate.ts [path/to/creative-candidates.json]
import { dirname, resolve } from "node:path";
import { loadJson, validateAgainst, report, ROOT } from "../_lib.ts";

const candidatesPath = process.argv[2] ?? ".generate-ads-img/runs/mock-image-generation/creative/creative-candidates.json";
const creativeDir = dirname(resolve(ROOT, candidatesPath));
const runDir = dirname(creativeDir);
const rel = (p: string) => p.replace(ROOT + "/", "");

const candidates = loadJson<any>(candidatesPath);
const selectionLog = loadJson<any>(`${rel(creativeDir)}/candidate-selection-log.json`);
const chatgpt = loadJson<any>(`${rel(runDir)}/generated-prompts/chatgpt.json`);
const gemini = loadJson<any>(`${rel(runDir)}/generated-prompts/gemini.json`);

let ok = true;
ok = report("creative-candidates", validateAgainst("creative-candidate.schema.json", candidates)) && ok;
ok = report("candidate-selection-log", validateAgainst("candidate-selection-log.schema.json", selectionLog)) && ok;
ok = report("generated-prompts/chatgpt", validateAgainst("image-adapter-output.schema.json", chatgpt)) && ok;
ok = report("generated-prompts/gemini", validateAgainst("image-adapter-output.schema.json", gemini)) && ok;

// Count / angle diversity check.
const count = candidates.candidate_count;
const angles = new Set(candidates.candidates.map((c: any) => c.angle));
if (candidates.candidates.length !== count) { console.error(`FAIL  candidate_count mismatch: ${candidates.candidates.length} != ${count}`); ok = false; }
else console.log(`PASS  candidate count = ${count}`);
if (angles.size !== candidates.candidates.length) { console.error(`FAIL  angles not distinct: ${[...angles].join(",")}`); ok = false; }
else console.log(`PASS  distinct angles = ${[...angles].join(",")}`);

// Korean copy verbatim cross-check: candidate spec copy must appear exactly in both adapter checklists.
function findOutput(file: any, id: string) { return file.outputs.find((o: any) => o.candidate_id === id); }
for (const c of candidates.candidates) {
  const copy = c.provider_neutral_spec.copy;
  for (const [name, file] of [["chatgpt", chatgpt], ["gemini", gemini]] as const) {
    const out = findOutput(file, c.candidate_id);
    if (!out) { console.error(`FAIL  ${name} missing output for ${c.candidate_id}`); ok = false; continue; }
    const checklistText = JSON.stringify(out.verification_checklist);
    const headlineOk = out.prompt.includes(copy.headline) && checklistText.includes(copy.headline);
    const ctaOk = out.prompt.includes(copy.cta) && checklistText.includes(copy.cta);
    const subOk = !copy.subcopy || (out.prompt.includes(copy.subcopy) && checklistText.includes(copy.subcopy));
    if (headlineOk && ctaOk && subOk) console.log(`PASS  ${name} ${c.candidate_id} Korean copy verbatim`);
    else { console.error(`FAIL  ${name} ${c.candidate_id} Korean copy not verbatim (headline=${headlineOk} cta=${ctaOk} sub=${subOk})`); ok = false; }
  }
  // Platform tailoring: the two adapters must NOT be byte-identical (prompt + negative differ).
  const cg = findOutput(chatgpt, c.candidate_id);
  const gm = findOutput(gemini, c.candidate_id);
  if (cg && gm) {
    const differentiated = cg.prompt !== gm.prompt && cg.negative_prompt !== gm.negative_prompt && cg.provider_notes !== gm.provider_notes;
    if (differentiated) console.log(`PASS  ${c.candidate_id} platform-tailored (chatgpt ≠ gemini)`);
    else { console.error(`FAIL  ${c.candidate_id} adapters not platform-differentiated`); ok = false; }
  }
}

process.exit(ok ? 0 : 1);
