import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const TSX = resolve("node_modules/.bin/tsx");
const GATE = resolve("shared/harness/validate-gen-run.ts");
const TMP = join(tmpdir(), "gai-validate-gen-run-test");
const reset = () => rmSync(TMP, { recursive: true, force: true });
after(reset);

// run the CLI, capture exit code + stdout (never throws — execFileSync would on non-zero, so catch)
function run(dir) {
  try {
    const out = execFileSync(TSX, [GATE, dir], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}
function writeArtifact(rel, obj) {
  const fp = join(TMP, rel);
  mkdirSync(resolve(fp, ".."), { recursive: true });
  writeFileSync(fp, JSON.stringify(obj));
}

test("empty run dir → exit 2 (nothing to gate)", () => {
  reset(); mkdirSync(TMP, { recursive: true });
  assert.equal(run(TMP).code, 2);
});

test("a conformant artifact → PASS, exit 0", () => {
  reset();
  writeArtifact("creative/critic-verdict.json", { verdicts: [{ candidate_id: "c1", pass: true }], overall_pass: true });
  const r = run(TMP);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /PASS {2}creative\/critic-verdict\.json/);
});

test("a non-conformant artifact → FAIL, exit 1 (caught, not silent)", () => {
  reset();
  // the exact live-run defect: critic-verdict missing `verdicts`, extra fields
  writeArtifact("creative/critic-verdict.json", { run_id: "x", overall_pass: true, candidate_verdicts: [] });
  const r = run(TMP);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {2}creative\/critic-verdict\.json/);
  assert.match(r.out, /GEN-RUN FAIL/);
});
