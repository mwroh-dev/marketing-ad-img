// Dedicated headless Chrome lifecycle for CDP collection — the launcher the interaction layer assumed but
// never had. `acquire-port.mjs` finds a FREE port; `lib.connect()` ATTACHES to a Chrome already on a port.
// Between them was a gap: launching that Chrome was a manual shell comment. This closes it.
//
// Non-intrusive by construction: `--headless=new` (no window) + a SEPARATE `--user-data-dir` (never the
// user's running profile/window), so the user keeps working while collection runs. The collection sources
// are PUBLIC ad-transparency libraries (Meta Ad Library, Google Ads Transparency — no login), so a
// throwaway data dir is the default. The launcher is profile-agnostic: if an AUTHENTICATED source were
// ever added it would pass a human-logged-in profile dir (credential stays in the profile, never in
// artifacts). Always `close()` in a finally — a leaked headless Chrome accumulates orphan tabs and slows.
//
// Usage:
//   import { acquirePort } from "./acquire-port.mjs";
//   import { launchChrome } from "./launch-chrome.mjs";
//   const port = acquirePort("adlib-collect");           // public ad-library collection (Meta/Google)
//   const chrome = await launchChrome({ port, userDataDir: "/tmp/gai-adlib" });
//   try { const client = await connect(port); /* collect */ } finally { await chrome.close(); }
import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
].filter(Boolean);

export function resolveChrome() {
  for (const c of CHROME_CANDIDATES) if (existsSync(c)) return c;
  throw new Error("Chrome/Chromium not found — set CHROME_BIN to the browser binary path");
}

// Flags: headless (no window) + isolated profile + quiet startup. Non-intrusive: never touches the user's
// window/profile, never foregrounds. `about:blank` start; collectors open their own background tab.
export function chromeFlags({ port, userDataDir, headless = true }) {
  return [
    headless ? "--headless=new" : null,
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1", // explicit localhost bind — never expose CDP to the network

    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-features=Translate,site-per-process",
    "--mute-audio",
    "about:blank",
  ].filter(Boolean);
}

export function endpointReady(port) {
  try {
    execFileSync("curl", ["-s", "--max-time", "1", `http://127.0.0.1:${port}/json/version`], { stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

// init-once memo (cf. Claude Code's `init = memoize`): one dedicated Chrome per (port, userDataDir) per
// process — repeated source runs reuse the same browser instead of relaunching. close() clears the memo.
const _chromeMemo = new Map();
export async function launchChrome(opts) {
  const key = `${opts.port}:${opts.userDataDir}`;
  if (_chromeMemo.has(key)) return _chromeMemo.get(key);
  const handle = await _launchChrome(opts);
  const memoized = { ...handle, async close() { _chromeMemo.delete(key); await handle.close(); } };
  _chromeMemo.set(key, memoized);
  return memoized;
}
async function _launchChrome({ port, userDataDir, headless = true, timeoutMs = 15000 }) {
  if (!port) throw new Error("launchChrome: port required (acquire one via acquirePort first)");
  if (!userDataDir) throw new Error("launchChrome: userDataDir required (isolated profile; never the user's running profile dir)");
  const bin = resolveChrome();
  const child = spawn(bin, chromeFlags({ port, userDataDir, headless }), { detached: false, stdio: "ignore" });
  const start = Date.now();
  while (!endpointReady(port)) {
    if (Date.now() - start > timeoutMs) {
      try { child.kill("SIGKILL"); } catch {}
      throw new Error(`Chrome CDP endpoint not ready on :${port} within ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  let closed = false;
  return {
    port,
    pid: child.pid,
    bin,
    async close() {
      if (closed) return;
      closed = true;
      try { child.kill("SIGTERM"); } catch {}
      // hard-kill fallback after a grace period
      await new Promise((r) => setTimeout(r, 800));
      try { child.kill("SIGKILL"); } catch {}
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2]);
  const dir = process.argv[3] ?? "/tmp/gai-chrome";
  if (!port) { console.error("Usage: node shared/collect/launch-chrome.mjs <port> [userDataDir]"); process.exit(2); }
  const chrome = await launchChrome({ port, userDataDir: dir });
  console.log(`LAUNCHED dedicated headless Chrome — pid ${chrome.pid}, CDP on :${port} (${chrome.bin})`);
  console.log("Press Ctrl-C to close.");
}
