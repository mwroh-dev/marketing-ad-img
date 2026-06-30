import test from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const TSX = resolve(ROOT, "node_modules/.bin/tsx");

function runTsx(code) {
  const result = spawnSync(process.execPath, [TSX, "--eval", code], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

test("MCP handlers dispatch every exposed P0 tool through execFile-style argv with consumer cwd", () => {
  const observed = runTsx(`
    import assert from "node:assert/strict";
    import { TOOL_CATALOG } from "./shared/tools/catalog.ts";
    import { callMcpTool } from "./shared/tools/mcp-handlers.mjs";

    async function main() {
      const root = ${JSON.stringify(ROOT)};
      const consumerCwd = "/tmp/marketing-img-consumer";
      const samples = {
        state_check_project: {},
        artifact_validate: { validator: "validate-candidate", artifactPath: "creative-candidates.json" },
        handoff_validate: { agentName: "temporal-change-analyst", handoffPath: "handoff.json", personaId: "p1" },
        collection_run_flow: { source: "meta", personaId: "p1", mode: "keyword", query: "", runId: "run-1", keywordPlanPath: "keyword-plan.json" },
        collection_select_images: { runId: "run-1", personaId: "p1" },
        collection_screen_images: { runId: "run-1", personaId: "p1", imagesDir: "images" },
        analysis_close_run: { runId: "run-1", stateDir: ".generate-ads-img" },
        analysis_validate_store: { personaId: "p1", stateDir: ".generate-ads-img" },
        analysis_build_market_position: { personaId: "p1", outPath: "creative/market-position-matrix.json" },
        generation_normalize_artifact: { kind: "creative-brief", filePath: "creative/creative-brief.json" },
        generation_finalize_candidates: { copyPath: "creative/copy-layout.json", chatgptPath: "generated-prompts/chatgpt.json", geminiPath: "generated-prompts/gemini.json", outDir: "creative" },
        generation_validate_run: { runDir: "runs/run-1" },
        recipe_serve_viewer: { personaId: "p1" },
        report_aggregate_competitive_trend: { personaId: "p1", runId: "run-1", todayIso: "2026-06-29" },
        report_render_competitive: { trendPath: "competitive-trend.json", outPath: "competitive-report.html" },
        creative_change_build_snapshot: { personaId: "p1", runId: "run-1", outRunId: "run-2" },
        creative_change_compare_snapshots: { fromSnapshotPath: "from.json", toSnapshotPath: "to.json", outPath: "diff.json" },
        creative_change_detect_candidates: { diffPath: "diff.json", outPath: "candidates.json" },
        creative_change_render_report: { reportPath: "creative-change-report.json", outPath: "creative-change-report.html" },
      };
      const calls = [];
      const runCommand = async (file, args, options) => {
        calls.push({ file, args, cwd: options.cwd, env: options.env });
        return { exitCode: 0, stdout: "x".repeat(7000), stderr: "" };
      };
      const exposed = TOOL_CATALOG.filter((tool) => tool.priority === "P0" && tool.mcp.exposed);
      for (const tool of exposed) {
        const input = samples[tool.mcp.name];
        assert.ok(input, "missing sample input for " + tool.mcp.name);
        const result = await callMcpTool(tool.mcp.name, input, {
          pluginRoot: root,
          consumerCwd,
          env: { CLAUDE_PLUGIN_ROOT: root, CLAUDE_PROJECT_DIR: consumerCwd },
          runCommand,
        });
        assert.equal(result.ok, true, tool.mcp.name);
        assert.equal(result.exitCode, 0, tool.mcp.name);
        assert.ok(result.stdout.length < 7000, "stdout should be truncated for " + tool.mcp.name);
      }
      const byTool = Object.fromEntries(calls.map((call, index) => [exposed[index].mcp.name, call]));
      for (const call of calls) {
        assert.equal(call.cwd, consumerCwd);
        assert.equal(call.env.CLAUDE_PLUGIN_ROOT, root);
        assert.equal(call.env.CLAUDE_PROJECT_DIR, consumerCwd);
        assert.ok(Array.isArray(call.args));
        assert.ok(!call.file.includes(" "), "command must be executable path, not a shell string");
      }
      console.log(JSON.stringify({
        count: calls.length,
        exposed: exposed.length,
        stateCheckArgs: byTool.state_check_project.args,
        artifactCommand: byTool.artifact_validate.file,
        artifactArgs: byTool.artifact_validate.args,
        handoffArgs: byTool.handoff_validate.args,
        finalizeArgs: byTool.generation_finalize_candidates.args,
      }));
    }
    main().catch((error) => { console.error(error); process.exit(1); });
  `);

  assert.equal(observed.count, observed.exposed);
  assert.deepEqual(observed.stateCheckArgs, [resolve(ROOT, "shared/harness/check-state.mjs")]);
  assert.equal(observed.artifactCommand, resolve(ROOT, "node_modules/.bin/tsx"));
  assert.deepEqual(observed.artifactArgs, [resolve(ROOT, "shared/validators/validate-candidate.ts"), "creative-candidates.json"]);
  assert.deepEqual(observed.handoffArgs, [resolve(ROOT, "shared/harness/validate-subagent-projection.mjs"), "temporal-change-analyst", "handoff.json", "--persona", "p1"]);
  assert.deepEqual(observed.finalizeArgs, [
    resolve(ROOT, "shared/harness/finalize-candidates.ts"),
    "--copy",
    "creative/copy-layout.json",
    "--chatgpt",
    "generated-prompts/chatgpt.json",
    "--gemini",
    "generated-prompts/gemini.json",
    "--out",
    "creative",
  ]);
});

test("MCP handler returns structured failure results instead of throwing raw child-process errors", () => {
  const observed = runTsx(`
    import { callMcpTool } from "./shared/tools/mcp-handlers.mjs";
    async function main() {
      const result = await callMcpTool("analysis_validate_store", { personaId: "missing" }, {
        pluginRoot: ${JSON.stringify(ROOT)},
        consumerCwd: "/tmp/marketing-img-consumer",
        env: {},
        runCommand: async () => ({ exitCode: 1, stdout: "", stderr: "STORE FAIL" }),
      });
      console.log(JSON.stringify(result));
    }
    main().catch((error) => { console.error(error); process.exit(1); });
  `);

  assert.equal(observed.ok, false);
  assert.equal(observed.exitCode, 1);
  assert.equal(observed.stderr, "STORE FAIL");
});

test("MCP command runner reports spawn failures when child stderr is empty", () => {
  const observed = runTsx(`
    import { runCommand } from "./shared/tools/mcp-handlers.mjs";
    async function main() {
      const result = await runCommand("/definitely/missing/marketing-img-tool", [], {
        cwd: ${JSON.stringify(ROOT)},
        env: process.env,
      });
      console.log(JSON.stringify(result));
    }
    main().catch((error) => { console.error(error); process.exit(1); });
  `);

  assert.equal(observed.exitCode, 1);
  assert.match(observed.stderr, /ENOENT|no such file/i);
});

test("TS-backed MCP tools use runtime deps from CLAUDE_PLUGIN_DATA when available", () => {
  const observed = runTsx(`
    import { callMcpTool } from "./shared/tools/mcp-handlers.mjs";
    async function main() {
      const pluginRoot = ${JSON.stringify(ROOT)};
      const pluginData = "/tmp/marketing-img-plugin-data";
      const calls = [];
      const result = await callMcpTool("artifact_validate", { validator: "validate-candidate", artifactPath: "creative-candidates.json" }, {
        pluginRoot,
        consumerCwd: "/tmp/marketing-img-consumer",
        env: { CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_PLUGIN_DATA: pluginData },
        runCommand: async (file, args, options) => {
          calls.push({ file, args, env: options.env });
          return { exitCode: 0, stdout: "ok", stderr: "" };
        },
      });
      console.log(JSON.stringify({ result, calls }));
    }
    main().catch((error) => { console.error(error); process.exit(1); });
  `);

  assert.equal(observed.result.ok, true);
  assert.equal(observed.calls[0].file, "/tmp/marketing-img-plugin-data/node_modules/.bin/tsx");
  assert.equal(observed.calls[0].env.CLAUDE_PLUGIN_DATA, "/tmp/marketing-img-plugin-data");
});
