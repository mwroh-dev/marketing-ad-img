import test from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
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
    const fm = frontmatter(readFileSync(resolve(ROOT, "agents", file), "utf8"));
    assert.ok(!fm.includes("mcp__plugin_marketing-img_m__"), `${file} must not receive marketing-img MCP tools`);
  }
});
