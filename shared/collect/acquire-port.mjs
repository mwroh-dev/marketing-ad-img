// Collision-proof CDP port acquisition. EXTERNAL tools may open a Chrome --remote-debugging-port without
// telling us, so we PROBE actual port liveness and only ever return a port with NOTHING listening. No external
// registry dependency — probe-only, fully self-contained. Mandatory before any CDP use in a lane.
//
// Usage:  node shared/collect/acquire-port.mjs <lane-name>
//   → prints a confirmed-FREE port, or exits 1 with reason.
// Lib:    import { probePort, acquirePort } from "./acquire-port.mjs"
import { execFileSync } from "node:child_process";

const RANGE = { start: 9223, end: 9299 };

// "free" = nothing listening (safe to launch our headless). "cdp" = a CDP endpoint already
// responds (someone else's Chrome). "busy" = a non-CDP listener.
export function probePort(port) {
  // 1) is anything LISTENING on this TCP port?
  let listening = false;
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { stdio: ["ignore", "pipe", "ignore"] }).toString();
    listening = out.trim().length > 0;
  } catch { listening = false; } // lsof exits non-zero when nothing matches
  if (!listening) return "free";
  // 2) something listens — is it a CDP endpoint? (then it's a Chrome, maybe external)
  try {
    execFileSync("curl", ["-s", "--max-time", "1", `http://127.0.0.1:${port}/json/version`], { stdio: ["ignore", "pipe", "ignore"] });
    return "cdp";
  } catch { return "busy"; }
}

// In-process init-once memo: a lane resolves to its port ONCE per process, so repeated source runs in one
// process reuse it without re-probing.
const _laneMemo = new Map();

// Return a port that is currently FREE (nothing listening). `lane` only scopes the per-process memo.
export function acquirePort(lane) {
  if (_laneMemo.has(lane)) return _laneMemo.get(lane);
  const result = _acquirePort();
  _laneMemo.set(lane, result);
  return result;
}
function _acquirePort() {
  for (let p = RANGE.start; p <= RANGE.end; p++) {
    if (probePort(p) === "free") return { port: p, reused: false };
  }
  throw new Error(`no free CDP port in ${RANGE.start}-${RANGE.end} (all listening — external collision likely)`);
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const lane = process.argv[2];
  if (!lane) { console.error("Usage: node shared/collect/acquire-port.mjs <lane-name>"); process.exit(1); }
  try { const { port } = acquirePort(lane); console.error(`acquired ${port} for ${lane}`); console.log(port); }
  catch (e) { console.error(e.message); process.exit(1); }
}
