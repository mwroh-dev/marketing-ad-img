import test from "node:test";
import assert from "node:assert/strict";
import { findRefs, checkRefs } from "./check-refs.mjs";

test("findRefs: extracts ${CLAUDE_PLUGIN_ROOT} file paths; handles @ prefix, trailing word, sentence dot, dedup", () => {
  const refs = findRefs(
    "see @${CLAUDE_PLUGIN_ROOT}/schemas/analysis/perception.schema.json-conformant JSON and " +
    "${CLAUDE_PLUGIN_ROOT}/knowledge/reference/modes/analysis.md. " +
    "again @${CLAUDE_PLUGIN_ROOT}/schemas/analysis/perception.schema.json (dup) " +
    "and a code ref ${CLAUDE_PLUGIN_ROOT}/shared/collect/ad-type-registry.mjs.",
  );
  assert.deepEqual(refs, [
    "schemas/analysis/perception.schema.json",         // stops at .json, not "-conformant"; deduped
    "knowledge/reference/modes/analysis.md",           // trailing sentence dot dropped
    "shared/collect/ad-type-registry.mjs",
  ]);
});

test("INTEGRITY: every ${CLAUDE_PLUGIN_ROOT} reference in the docs/agents resolves to a real file", () => {
  const { checked, broken } = checkRefs();
  assert.ok(checked > 50, `expected the convention to be in use (got ${checked} refs)`);
  assert.deepEqual(broken, [], `broken \${CLAUDE_PLUGIN_ROOT} refs (fix the path or the file):\n${broken.map((b) => `  ${b.file} → ${b.ref}`).join("\n")}`);
});
