// Generation-run conformance gate — validates EVERY artifact a generation run produced against its schema,
// so a non-conformant agent/orchestrator output (e.g. a critic-verdict missing `verdicts`, a creative-brief with
// an extra field, an improvised market-position-matrix) is caught LOUDLY instead of passing silently. The
// runbook calls this before presenting candidates; a single FAIL exits non-zero so the orchestrator must repair
// the offending artifact (re-dispatch that one agent / run the deterministic producer) rather than ship it.
//
// Deterministic — no LLM, no provider call. Reuses the same validateAgainst/report path as the per-artifact
// validators; the only new thing here is the run-dir → (file, schema) map applied to one whole run at once.
//
// Usage:  tsx shared/harness/validate-gen-run.ts <gen-run-dir>
//   → PASS/FAIL per present artifact; exit 0 iff all present artifacts conform, else 1.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadJson, validateAgainst, report } from "../_lib.ts";

// run-relative path → schema basename. Each is OPTIONAL (a run may not have produced every stage yet); only
// artifacts that exist are gated. generated-prompts/{chatgpt,gemini} share the provider-neutral adapter schema.
const ARTIFACTS: Array<[string, string]> = [
  ["creative/creative-opportunity.json", "creative-opportunity.schema.json"],
  ["creative/creative-brief.json", "creative-brief.schema.json"],
  ["creative/copy-layout.json", "copy-layout.schema.json"],
  ["creative/market-position-matrix.json", "market-position-matrix.schema.json"],
  ["creative/critic-verdict.json", "critic-verdict.schema.json"],
  ["generated-prompts/chatgpt.json", "image-adapter-output.schema.json"],
  ["generated-prompts/gemini.json", "image-adapter-output.schema.json"],
  ["creative-candidates.json", "creative-candidate.schema.json"],
  ["candidate-selection-log.json", "candidate-selection-log.schema.json"],
];

export function validateGenRun(runDir: string): { ok: boolean; checked: number; failures: string[] } {
  const failures: string[] = [];
  let checked = 0;
  for (const [rel, schema] of ARTIFACTS) {
    const fp = resolve(runDir, rel);
    if (!existsSync(fp)) continue; // stage not produced (yet) — not a failure
    checked++;
    const r = validateAgainst(schema, loadJson(fp));
    if (!report(rel, r)) failures.push(rel);
  }
  return { ok: failures.length === 0, checked, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = process.argv[2];
  if (!runDir) { console.error("Usage: tsx shared/harness/validate-gen-run.ts <gen-run-dir>"); process.exit(2); }
  const { ok, checked, failures } = validateGenRun(resolve(runDir));
  if (checked === 0) { console.error(`(no generation artifacts found under ${runDir})`); process.exit(2); }
  console.log(ok ? `\nGEN-RUN PASS — ${checked} artifacts conform` : `\nGEN-RUN FAIL — ${failures.length}/${checked} non-conformant: ${failures.join(", ")}`);
  process.exit(ok ? 0 : 1);
}
