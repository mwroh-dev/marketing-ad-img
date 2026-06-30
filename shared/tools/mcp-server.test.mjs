import test from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const TSX = resolve(ROOT, "node_modules/.bin/tsx");

function runTsx(code, env = {}) {
  const result = spawnSync(process.execPath, [TSX, "--eval", code], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT, ...env },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

test("MCP server tool list exposes exactly the P0 catalog tools by MCP name", () => {
  const observed = runTsx(`
    import { TOOL_CATALOG } from "./shared/tools/catalog.ts";
    import { listMcpToolDefinitions } from "./shared/tools/mcp-server.mjs";
    const expected = TOOL_CATALOG.filter((tool) => tool.priority === "P0" && tool.mcp.exposed).map((tool) => tool.mcp.name).sort();
    const actual = listMcpToolDefinitions().map((tool) => tool.name).sort();
    console.log(JSON.stringify({ expected, actual }));
  `);

  assert.deepEqual(observed.actual, observed.expected);
  assert.ok(observed.actual.includes("handoff_validate"));
  assert.ok(!observed.actual.includes("orchestration_validate_subagent_projection"));
});

test("MCP server and handlers share one runtime registry for exposed tool contracts", () => {
  const observed = runTsx(`
    import assert from "node:assert/strict";
    import { TOOL_CATALOG } from "./shared/tools/catalog.ts";
    import { listMcpToolDefinitions } from "./shared/tools/mcp-server.mjs";
    import { TOOL_RUNTIME } from "./shared/tools/mcp-runtime-registry.mjs";

    const exposed = TOOL_CATALOG
      .filter((tool) => tool.priority === "P0" && tool.mcp.exposed)
      .map((tool) => tool.mcp.name)
      .sort();
    const runtime = Object.keys(TOOL_RUNTIME).sort();
    assert.deepEqual(runtime, exposed);

    const definitions = listMcpToolDefinitions();
    for (const definition of definitions) {
      const runtimeEntry = TOOL_RUNTIME[definition.name];
      assert.ok(runtimeEntry, "missing runtime entry for " + definition.name);
      assert.equal(typeof runtimeEntry.buildCommand, "function", definition.name);
      assert.equal(definition.inputSchema, runtimeEntry.inputSchema, definition.name);
    }
    console.log(JSON.stringify({ count: runtime.length }));
  `);

  assert.equal(observed.count, 19);
});

test("stdio MCP tools/list exposes exactly the P0 catalog tools by MCP name", async () => {
  const expected = runTsx(`
    import { TOOL_CATALOG } from "./shared/tools/catalog.ts";
    console.log(JSON.stringify(TOOL_CATALOG.filter((tool) => tool.priority === "P0" && tool.mcp.exposed).map((tool) => tool.mcp.name).sort()));
  `);
  const client = new Client({ name: "marketing-img-test", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: TSX,
    args: ["shared/tools/mcp-server.mjs"],
    cwd: ROOT,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PROJECT_DIR: ROOT },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), expected);
  } finally {
    await client.close();
  }
});

test("bootstrap stdio MCP tools/list works from plugin data runtime", async () => {
  const pluginRoot = mkdtempSync(`${tmpdir()}/marketing-img-plugin-root-`);
  const pluginData = mkdtempSync(`${tmpdir()}/marketing-img-plugin-data-`);
  mkdirSync(resolve(pluginRoot, "shared/tools"), { recursive: true });
  for (const file of ["mcp-bootstrap.mjs", "mcp-server.mjs", "mcp-handlers.mjs", "mcp-runtime-registry.mjs", "catalog.ts", "definitions.ts", "types.ts"]) {
    copyFileSync(resolve(ROOT, "shared/tools", file), resolve(pluginRoot, "shared/tools", file));
  }
  copyFileSync(resolve(ROOT, "package.json"), resolve(pluginRoot, "package.json"));
  copyFileSync(resolve(ROOT, "package-lock.json"), resolve(pluginRoot, "package-lock.json"));
  copyFileSync(resolve(ROOT, "package.json"), resolve(pluginData, "package.json"));
  copyFileSync(resolve(ROOT, "package-lock.json"), resolve(pluginData, "package-lock.json"));
  symlinkSync(resolve(ROOT, "node_modules"), resolve(pluginData, "node_modules"), "dir");

  const expected = runTsx(`
    import { TOOL_CATALOG } from "./shared/tools/catalog.ts";
    console.log(JSON.stringify(TOOL_CATALOG.filter((tool) => tool.priority === "P0" && tool.mcp.exposed).map((tool) => tool.mcp.name).sort()));
  `);
  const client = new Client({ name: "marketing-img-bootstrap-test", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(pluginRoot, "shared/tools/mcp-bootstrap.mjs")],
    cwd: pluginRoot,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PLUGIN_DATA: pluginData,
      CLAUDE_PROJECT_DIR: ROOT,
    },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), expected);
  } finally {
    await client.close();
  }
});

test("MCP server call wrapper shapes success and failure as MCP content", () => {
  const observed = runTsx(`
    import { callMcpToolForServer } from "./shared/tools/mcp-server.mjs";
    async function main() {
      const ok = await callMcpToolForServer("state_check_project", {}, {
        pluginRoot: ${JSON.stringify(ROOT)},
        consumerCwd: "/tmp/marketing-img-consumer",
        env: {},
        runCommand: async () => ({ exitCode: 0, stdout: "STATE OK", stderr: "" }),
      });
      const fail = await callMcpToolForServer("analysis_validate_store", { personaId: "p1" }, {
        pluginRoot: ${JSON.stringify(ROOT)},
        consumerCwd: "/tmp/marketing-img-consumer",
        env: {},
        runCommand: async () => ({ exitCode: 1, stdout: "", stderr: "STORE FAIL" }),
      });
      console.log(JSON.stringify({ ok, fail }));
    }
    main().catch((error) => { console.error(error); process.exit(1); });
  `);

  assert.equal(observed.ok.isError, false);
  assert.equal(JSON.parse(observed.ok.content[0].text).ok, true);
  assert.equal(observed.fail.isError, true);
  assert.equal(JSON.parse(observed.fail.content[0].text).stderr, "STORE FAIL");
});

test("real state_check_project integration uses CLAUDE_PROJECT_DIR as the consumer cwd", () => {
  const consumer = mkdtempSync(`${tmpdir()}/marketing-img-mcp-empty-`);
  const observed = runTsx(`
    import { callMcpTool } from "./shared/tools/mcp-handlers.mjs";
    async function main() {
      const result = await callMcpTool("state_check_project", {}, {
        pluginRoot: ${JSON.stringify(ROOT)},
        consumerCwd: ${JSON.stringify(consumer)},
        env: { CLAUDE_PLUGIN_ROOT: ${JSON.stringify(ROOT)}, CLAUDE_PROJECT_DIR: ${JSON.stringify(consumer)} },
      });
      console.log(JSON.stringify(result));
    }
    main().catch((error) => { console.error(error); process.exit(1); });
  `);
  assert.equal(observed.ok, true);
  assert.equal(observed.exitCode, 0);
  assert.match(observed.stdout, /setup/i);
});
