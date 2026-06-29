import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { detectChangeCandidates } from "./change-candidates.mjs";
import { validateAgainst } from "./schema-validate.mjs";

const FIXTURE_ROOT = resolve("shared/evals/creative-change-analysis/fixtures");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

for (const name of readdirSync(FIXTURE_ROOT).sort()) {
  const dir = resolve(FIXTURE_ROOT, name);
  const inputDiff = resolve(dir, "input/creative-diff.json");
  const expected = resolve(dir, "expected/change-candidates.json");
  if (!existsSync(inputDiff)) continue;

  test(`creative-change fixture: ${name}`, () => {
    const contextPath = resolve(dir, "input/context-calendar.json");
    if (existsSync(contextPath)) {
      const contextValidation = validateAgainst("context-calendar.schema.json", readJson(contextPath));
      assert.equal(contextValidation.ok, true, contextValidation.errors.join("\n"));
    }
    const out = detectChangeCandidates(readJson(inputDiff));
    const validation = validateAgainst("change-candidate.schema.json", out);
    assert.equal(validation.ok, true, validation.errors.join("\n"));
    assert.deepEqual(out, readJson(expected));
  });
}

test("creative-change fixture: single-snapshot-no-edge has no diff input", () => {
  const assertions = readJson(resolve(FIXTURE_ROOT, "single-snapshot-no-edge/expected/no-edge.assertions.json"));
  assert.equal(assertions.diff_expected, false);
  assert.equal(assertions.candidates_expected, false);
  assert.equal(existsSync(resolve(FIXTURE_ROOT, "single-snapshot-no-edge/input/creative-diff.json")), false);
});
