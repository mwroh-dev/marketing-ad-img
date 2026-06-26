// Drift gate: the committed schema artifacts (*.schema.json, *.view.md) MUST equal what schemas/build.ts emits
// from the *.ts sources. Re-emits, then asserts git sees no change. If this fails: run `npx tsx schemas/build.ts`
// and commit the regenerated files.
import { test } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";

test("emitted schema artifacts are in sync with their .ts sources", () => {
  execSync("./node_modules/.bin/tsx schemas/build.ts", { stdio: "ignore" });
  // git diff = tracked files whose content changed (a committed artifact now differs from its rebuilt source).
  // Untracked (not-yet-committed, mid-migration) files are intentionally not flagged.
  const dirty = execSync("git diff --name-only -- schemas").toString().trim();
  assert.equal(dirty, "", `stale schema artifacts — run \`npx tsx schemas/build.ts\` and commit:\n${dirty}`);
});
