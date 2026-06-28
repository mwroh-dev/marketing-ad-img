// Reference-integrity linter: every `${CLAUDE_PLUGIN_ROOT}/<path>` reference in the docs/agent files must resolve
// to a real file. This is the automated guard for the I2 class — a broken/renamed path ref (e.g. a moved schema, a
// typo'd agent file) silently rots because nothing checks it. Run in the test suite (check-refs.test.mjs) so CI
// fails on a broken ref. Read-only.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SCAN_DIRS = ["agents", "knowledge", "commands", "shared"];
const SCAN_FILES = ["AGENTS.md", "CLAUDE.md", "README.md"];
// a path ref ends at a known file extension (so "X.schema.json-conformant" → "X.schema.json", not the whole word).
const REF_RE = /\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_./-]+?\.(?:md|json|mjs|cjs|ts|mts|yaml|yml|html|js|txt))\b/g;

function walkMd(dir, acc) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkMd(p, acc);
    else if (e.name.endsWith(".md")) acc.push(p);
  }
}

export function scanFiles(root = ROOT) {
  const files = [];
  for (const d of SCAN_DIRS) walkMd(resolve(root, d), files);
  for (const f of SCAN_FILES) { const p = resolve(root, f); if (existsSync(p)) files.push(p); }
  return files;
}

// every ${CLAUDE_PLUGIN_ROOT}/<file> path token in a string (deduped per call).
export function findRefs(text) {
  return [...new Set([...text.matchAll(REF_RE)].map((m) => m[1]))];
}

export function checkRefs(root = ROOT) {
  const broken = [];
  let checked = 0;
  for (const f of scanFiles(root)) {
    const rel = f.slice(String(root).length + 1);
    for (const ref of findRefs(readFileSync(f, "utf8"))) {
      checked++;
      if (!existsSync(resolve(root, ref))) broken.push({ file: rel, ref });
    }
  }
  return { checked, broken };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { checked, broken } = checkRefs();
  if (broken.length) {
    console.error(`✗ ${broken.length} broken \${CLAUDE_PLUGIN_ROOT} ref(s) of ${checked} checked:`);
    for (const b of broken) console.error(`  ${b.file}  →  ${b.ref}`);
    process.exit(1);
  }
  console.log(`✓ all ${checked} \${CLAUDE_PLUGIN_ROOT} refs resolve`);
}
