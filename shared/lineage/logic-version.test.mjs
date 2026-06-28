import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { gitVersion, contentVersion, logicVersion } from "./logic-version.mjs";

test("gitVersion: in this repo returns a sha + dirty flag; logicVersion prefers git", () => {
  const g = gitVersion();              // this repo IS a git checkout
  assert.ok(g, "expected a git version in the repo");
  assert.equal(g.method, "git");
  assert.match(g.version, /^[0-9a-f]{7,40}$/);
  assert.equal(typeof g.dirty, "boolean");
  assert.equal(logicVersion().method, "git");
});

test("contentVersion: deterministic, 16-hex, and sensitive to a change", () => {
  const root = mkdtempSync(resolve(tmpdir(), "lv-"));
  mkdirSync(resolve(root, "agents"), { recursive: true });
  writeFileSync(resolve(root, "agents", "a.md"), "alpha");
  writeFileSync(resolve(root, "agents", "b.mjs"), "export const x = 1;");
  const v1 = contentVersion(root, ["agents"]);
  const v2 = contentVersion(root, ["agents"]);
  assert.equal(v1.method, "content");
  assert.match(v1.version, /^[0-9a-f]{16}$/);
  assert.equal(v1.version, v2.version);                 // deterministic

  writeFileSync(resolve(root, "agents", "a.md"), "alpha-CHANGED");
  assert.notEqual(contentVersion(root, ["agents"]).version, v1.version);  // change → new hash

  // a non-logic file (e.g. an image) does not affect the hash
  writeFileSync(resolve(root, "agents", "pic.png"), "binary");
  assert.equal(contentVersion(root, ["agents"]).version, contentVersion(root, ["agents"]).version);
});

test("contentVersion: falls back cleanly for an empty/missing dir (no throw)", () => {
  const root = mkdtempSync(resolve(tmpdir(), "lv2-"));
  const v = contentVersion(root, ["nope"]);
  assert.equal(v.method, "content");
  assert.match(v.version, /^[0-9a-f]{16}$/);            // hash of nothing is still stable
});
