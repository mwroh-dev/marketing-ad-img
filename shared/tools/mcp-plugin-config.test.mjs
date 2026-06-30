import test from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const TSX = resolve(ROOT, "node_modules/.bin/tsx");

function loadCatalog() {
  const code = `
    import { TOOL_CATALOG } from ${JSON.stringify(pathToFileURL(resolve(HERE, "catalog.ts")).href)};
    console.log(JSON.stringify({ TOOL_CATALOG }));
  `;
  const result = spawnSync(process.execPath, [TSX, "--eval", code], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout).TOOL_CATALOG;
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, "missing frontmatter");
  return match[1];
}

function maybeFrontmatter(text) {
  return text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? null;
}

test("plugin manifest exposes the bundled MCP server named m", () => {
  const plugin = JSON.parse(readFileSync(resolve(ROOT, ".claude-plugin/plugin.json"), "utf8"));
  const mcp = JSON.parse(readFileSync(resolve(ROOT, ".mcp.json"), "utf8"));
  const hooks = JSON.parse(readFileSync(resolve(ROOT, "hooks/hooks.json"), "utf8"));

  assert.equal(plugin.mcpServers, "./.mcp.json");
  assert.equal(plugin.hooks, "./hooks/hooks.json");
  assert.deepEqual(mcp.mcpServers.m, {
    command: "node",
    args: ["${CLAUDE_PLUGIN_ROOT}/shared/tools/mcp-bootstrap.mjs"],
    cwd: "${CLAUDE_PLUGIN_ROOT}",
  });
  assert.deepEqual(hooks.hooks.SessionStart[0].hooks[0], {
    type: "command",
    command: "node",
    args: ["${CLAUDE_PLUGIN_ROOT}/shared/tools/mcp-bootstrap.mjs", "--prepare-only"],
  });
});

test("dev Claude wrapper supplies plugin env for repo-root MCP diagnostics", () => {
  const scriptPath = resolve(ROOT, "scripts/dev-claude.sh");
  assert.equal(existsSync(scriptPath), true);
  const mode = statSync(scriptPath).mode & 0o777;
  assert.equal((mode & 0o111) !== 0, true, "dev wrapper must be executable");

  const script = readFileSync(scriptPath, "utf8");
  assert.match(script, /CLAUDE_PLUGIN_ROOT=/);
  assert.match(script, /CLAUDE_PLUGIN_DATA=/);
  assert.match(script, /exec claude "\$@"/);
  assert.match(
    readFileSync(resolve(ROOT, "CLAUDE.md"), "utf8"),
    /scripts\/dev-claude\.sh/,
  );
});

test("orchestrator frontmatter grants the actual Claude Code MCP tool names", () => {
  const tools = frontmatter(readFileSync(resolve(ROOT, "agents/orchestrator.md"), "utf8")).match(/^tools:\s*(.+)$/m)?.[1] ?? "";
  for (const builtin of ["Read", "Write", "Grep", "Glob", "Agent", "Skill"]) {
    assert.match(tools, new RegExp(`(?:^|, )${builtin}(?:,|$)`), `missing builtin ${builtin}`);
  }
  for (const tool of loadCatalog().filter((candidate) => candidate.priority === "P0" && candidate.mcp.exposed)) {
    assert.match(tools, new RegExp(`(?:^|, )${tool.mcp.claudeCodeName}(?:,|$)`), `missing MCP tool ${tool.mcp.claudeCodeName}`);
  }
});

test("specialist subagents do not receive marketing-img MCP tools", () => {
  for (const file of readdirSync(resolve(ROOT, "agents")).filter((name) => name.endsWith(".md") && name !== "orchestrator.md")) {
    const fm = maybeFrontmatter(readFileSync(resolve(ROOT, "agents", file), "utf8"));
    if (!fm) {
      assert.equal(file, "ad-image-screener.md", `${file} is missing frontmatter`);
      continue;
    }
    assert.ok(!fm.includes("mcp__plugin_marketing-img_m__"), `${file} must not receive marketing-img MCP tools`);
  }
});

test("deprecated historical agent notes are not discoverable as subagents", () => {
  const text = readFileSync(resolve(ROOT, "agents/ad-image-screener.md"), "utf8");
  assert.equal(maybeFrontmatter(text), null);
  assert.match(text, /no Claude Code subagent frontmatter/);
});
