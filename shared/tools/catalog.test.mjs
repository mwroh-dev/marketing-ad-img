import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const CATALOG = resolve(HERE, "catalog.ts");
const TSX = resolve(ROOT, "node_modules/.bin/tsx");

function loadCatalog() {
  const code = `
    import { ACTIVE_AGENT_IDS, TOOL_CATALOG } from ${JSON.stringify(pathToFileURL(CATALOG).href)};
    console.log(JSON.stringify({ ACTIVE_AGENT_IDS, TOOL_CATALOG }));
  `;
  const result = spawnSync(process.execPath, [TSX, "--eval", code], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function activeAgentNamesFromFiles() {
  return readdirSync(resolve(ROOT, "agents"))
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const text = readFileSync(resolve(ROOT, "agents", file), "utf8");
      const name = text.match(/^name:\s*(.+)$/m)?.[1]?.trim();
      const deprecated = /^\s*description:\s*["']?\[DEPRECATED\b/im.test(text);
      return { name, deprecated };
    })
    .filter((agent) => agent.name && !agent.deprecated)
    .map((agent) => agent.name)
    .sort();
}

test("catalog lists the active agent ids and excludes deprecated agents", () => {
  const { ACTIVE_AGENT_IDS, TOOL_CATALOG } = loadCatalog();
  assert.deepEqual([...ACTIVE_AGENT_IDS].sort(), activeAgentNamesFromFiles());
  assert.ok(!ACTIVE_AGENT_IDS.includes("ad-image-screener"));

  for (const tool of TOOL_CATALOG) {
    assert.ok(!tool.callableBy.includes("ad-image-screener"), `${tool.id} must not be callable by deprecated ad-image-screener`);
  }
});

test("tool ids, priorities, callableBy, and implementation refs are catalog-consistent", () => {
  const { ACTIVE_AGENT_IDS, TOOL_CATALOG } = loadCatalog();
  const activeAgents = new Set(ACTIVE_AGENT_IDS);
  const ids = new Set();
  const mcpNames = new Set();

  for (const tool of TOOL_CATALOG) {
    assert.match(tool.id, /^[a-z]+(?:_[a-z0-9]+)*$/, `bad tool id: ${tool.id}`);
    assert.ok(!ids.has(tool.id), `duplicate tool id: ${tool.id}`);
    ids.add(tool.id);
    assert.ok(["P0", "P1"].includes(tool.priority), `${tool.id} has invalid priority`);
    assert.ok(tool.callableBy.length > 0, `${tool.id} must have callableBy`);
    for (const agent of tool.callableBy) {
      assert.ok(activeAgents.has(agent), `${tool.id} has unknown callableBy agent ${agent}`);
    }
    if (tool.priority === "P0") {
      assert.ok(tool.currentImplementation, `${tool.id} P0 tool needs currentImplementation`);
      assert.ok(existsSync(resolve(ROOT, tool.currentImplementation.path)), `${tool.id} implementation path missing: ${tool.currentImplementation.path}`);
      assert.equal(tool.mcp.exposed, true, `${tool.id} P0 tool must be exposed through MCP`);
    }
    if (tool.priority === "P1") {
      assert.equal(tool.mcp.exposed, false, `${tool.id} P1 tool must remain catalog-only`);
    }
    assert.match(tool.mcp.name, /^[a-z]+(?:_[a-z0-9]+)*$/, `${tool.id} has invalid MCP tool name`);
    assert.ok(!mcpNames.has(tool.mcp.name), `duplicate MCP tool name: ${tool.mcp.name}`);
    mcpNames.add(tool.mcp.name);
    assert.equal(tool.mcp.claudeCodeName, `mcp__plugin_marketing-img_m__${tool.mcp.name}`, `${tool.id} has wrong Claude Code MCP name`);
    assert.ok(tool.mcp.claudeCodeName.length <= 64, `${tool.id} Claude Code MCP name is too long`);
  }
});

test("MCP alias keeps the projection guard tool name short and maps to the catalog id", () => {
  const { TOOL_CATALOG } = loadCatalog();
  const tool = TOOL_CATALOG.find((candidate) => candidate.id === "orchestration_validate_subagent_projection");
  assert.ok(tool);
  assert.equal(tool.mcp.exposed, true);
  assert.equal(tool.mcp.name, "handoff_validate");
  assert.equal(tool.mcp.claudeCodeName, "mcp__plugin_marketing-img_m__handoff_validate");
});

test("catalog covers the agreed P0 shared tool surface", () => {
  const { TOOL_CATALOG } = loadCatalog();
  const p0 = new Set(TOOL_CATALOG.filter((tool) => tool.priority === "P0").map((tool) => tool.id));
  assert.deepEqual([...p0].sort(), [
    "analysis_build_market_position",
    "analysis_close_run",
    "analysis_validate_store",
    "artifact_validate",
    "collection_run_flow",
    "collection_screen_images",
    "collection_select_images",
    "creative_change_build_snapshot",
    "creative_change_compare_snapshots",
    "creative_change_detect_candidates",
    "creative_change_render_report",
    "generation_finalize_candidates",
    "generation_normalize_artifact",
    "generation_validate_run",
    "orchestration_validate_subagent_projection",
    "recipe_serve_viewer",
    "report_aggregate_competitive_trend",
    "report_render_competitive",
    "state_check_project",
  ]);
});

test("side-effect metadata captures risky collection behavior", () => {
  const { TOOL_CATALOG } = loadCatalog();
  const byId = new Map(TOOL_CATALOG.map((tool) => [tool.id, tool]));

  assert.deepEqual(byId.get("collection_select_images").sideEffects.sort(), ["move_files", "serve_localhost", "write_state"]);
  assert.equal(byId.get("collection_select_images").requiresUserConfirmation, true);
  assert.deepEqual(byId.get("collection_run_flow").sideEffects.sort(), ["cdp_public_browser", "network_public", "spawn_chrome", "write_state"]);
  assert.equal(byId.get("orchestration_validate_subagent_projection").sideEffects.includes("read_only"), true);
});
