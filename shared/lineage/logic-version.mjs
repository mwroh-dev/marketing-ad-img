// The logic-version stamp: WHICH version of the shared plugin logic produced an artifact. A change here is what
// makes prior artifacts (in the touched scope) stale. Prefer the plugin's git sha (the logic lives in this repo and
// a logic change is a commit — see provenance-lineage.md); fall back to a deterministic content-hash of the logic
// dirs for a shipped, non-git plugin. Pure read-only (git read + file read); no network, no state writes.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..", "..");                 // shared/lineage → repo (plugin) root

// the dirs that define the shared analysis/generation behaviour (the content-hash domain).
export const LOGIC_DIRS = ["agents", "schemas", "knowledge/reference", "shared/collect", "shared/harness", "shared/validators", "shared/lineage"];
const LOGIC_FILE_RE = /\.(md|mjs|ts|json)$/;

// git sha of the plugin (+ dirty flag) — null if not a git checkout / git unavailable.
export function gitVersion(root = ROOT) {
  try {
    const sha = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (!/^[0-9a-f]{7,40}$/.test(sha)) return null;
    const porcelain = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return { version: sha, method: "git", dirty: porcelain.trim().length > 0 };
  } catch { return null; }
}

// deterministic content-hash over the logic files (path + bytes, sorted) — for a shipped non-git plugin.
export function contentVersion(root = ROOT, dirs = LOGIC_DIRS) {
  const files = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (LOGIC_FILE_RE.test(e.name)) files.push(p);
    }
  };
  for (const rel of dirs) walk(resolve(root, rel));
  files.sort();                                                // stable order → deterministic hash
  const h = createHash("sha256");
  for (const f of files) { h.update(f.slice(String(root).length).replace(/\\/g, "/")); h.update("\0"); h.update(readFileSync(f)); h.update("\0"); }   // normalize path sep → same hash on Windows/POSIX
  return { version: h.digest("hex").slice(0, 16), method: "content" };
}

// the stamp used by persist-artifact: git when available, else a content hash.
export function logicVersion(root = ROOT) {
  return gitVersion(root) || contentVersion(root);
}
