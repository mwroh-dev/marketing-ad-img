// Drift gate: the committed schema artifacts (*.schema.json, *.view.md) MUST equal what schemas/build.ts emits
// from the *.ts sources. Re-emits, then asserts git sees no change. If this fails: run `npx tsx schemas/build.ts`
// and commit the regenerated files.
import { test } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith(".schema.json") || path.endsWith(".view.md") ? [path] : [];
  });
}

function snapshot(files) {
  return new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
}

test("emitted schema artifacts are in sync with their .ts sources", () => {
  const beforeFiles = walk(resolve("schemas")).sort();
  const before = snapshot(beforeFiles);
  execSync("./node_modules/.bin/tsx schemas/build.ts", { stdio: "ignore" });
  const afterFiles = walk(resolve("schemas")).sort();
  const created = afterFiles.filter((f) => !beforeFiles.includes(f));
  const createdSet = new Set(created);
  const dirty = afterFiles.filter((f) => !createdSet.has(f) && before.get(f) !== readFileSync(f, "utf8"));
  const stale = [...created, ...dirty].map((f) => f.replace(`${resolve(".")}/`, "")).join("\n");
  assert.equal(stale, "", `stale schema artifacts — run \`npx tsx schemas/build.ts\` and commit:\n${stale}`);
});
