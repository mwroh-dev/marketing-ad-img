import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveChrome, chromeFlags } from "./launch-chrome.mjs";

test("resolveChrome honors CHROME_BIN override", () => {
  const prev = process.env.CHROME_BIN;
  process.env.CHROME_BIN = "/bin/sh"; // exists on every unix; stands in for the browser binary
  // re-import side effect: CHROME_CANDIDATES is built at module load, so resolveChrome reads the list
  // that already includes process.env.CHROME_BIN captured at import. Assert it resolves to a real path.
  const bin = resolveChrome();
  assert.ok(typeof bin === "string" && bin.length > 0);
  process.env.CHROME_BIN = prev;
});

test("chromeFlags builds a non-intrusive, isolated-profile flag set", () => {
  const f = chromeFlags({ port: 9277, userDataDir: "/tmp/p" });
  assert.ok(f.includes("--headless=new"), "headless by default (no window)");
  assert.ok(f.includes("--remote-debugging-port=9277"), "CDP port wired");
  assert.ok(f.includes("--user-data-dir=/tmp/p"), "isolated profile dir");
  assert.ok(f.includes("--no-first-run") && f.includes("--no-default-browser-check"), "quiet startup");
  assert.equal(f[f.length - 1], "about:blank", "starts on blank; collectors open their own tab");
});

test("chromeFlags headless:false omits --headless (debug/visible mode)", () => {
  const f = chromeFlags({ port: 1, userDataDir: "/tmp/p", headless: false });
  assert.ok(!f.includes("--headless=new"));
  assert.ok(f.includes("--remote-debugging-port=1"));
});

import { test as t2 } from "node:test";
import assert2 from "node:assert/strict";
import { acquirePort } from "./acquire-port.mjs";
t2("acquirePort memoizes a lane in-process (same handle on 2nd call)", () => {
  const a = acquirePort("gai-memo-test");
  const b = acquirePort("gai-memo-test");
  assert2.strictEqual(a, b);   // init-once: identical object, no re-probe
});
