import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOL_CATALOG } from "./catalog.ts";

export const OUTPUT_CHAR_LIMIT = 6000;

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLUGIN_ROOT = resolve(HERE, "../..");
const EXPOSED_TOOLS = new Map(
  TOOL_CATALOG.filter((tool) => tool.priority === "P0" && tool.mcp.exposed).map((tool) => [tool.mcp.name, tool]),
);

function req(input, key) {
  const value = input?.[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`missing required string input: ${key}`);
  }
  return value;
}

function opt(input, key) {
  const value = input?.[key];
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error(`input must be a string: ${key}`);
  }
  return value;
}

function pluginPath(pluginRoot, path) {
  return resolve(pluginRoot, path);
}

function tsxBin(context) {
  const base = context.pluginData ?? context.pluginRoot;
  return pluginPath(base, "node_modules/.bin/tsx");
}

function nodeScript(pluginRoot, scriptPath, args = [], artifacts = []) {
  return {
    file: process.execPath,
    args: [pluginPath(pluginRoot, scriptPath), ...args],
    artifacts,
  };
}

function tsScript(context, scriptPath, args = [], artifacts = []) {
  return {
    file: tsxBin(context),
    args: [pluginPath(context.pluginRoot, scriptPath), ...args],
    artifacts,
  };
}

function validatorScript(pluginRoot, validator) {
  if (!/^validate-[a-z0-9-]+$/.test(validator)) {
    throw new Error(`invalid validator name: ${validator}`);
  }
  const script = pluginPath(pluginRoot, `shared/validators/${validator}.ts`);
  if (!existsSync(script)) {
    throw new Error(`unknown validator: ${validator}`);
  }
  return script;
}

export function truncateText(value, limit = OUTPUT_CHAR_LIMIT) {
  const text = String(value ?? "");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n[truncated ${text.length - limit} chars]`;
}

export function runtimeContext(overrides = {}) {
  const env = { ...process.env, ...(overrides.env ?? {}) };
  const pluginRoot = overrides.pluginRoot ?? env.CLAUDE_PLUGIN_ROOT ?? DEFAULT_PLUGIN_ROOT;
  const pluginData = overrides.pluginData ?? env.CLAUDE_PLUGIN_DATA;
  const consumerCwd = overrides.consumerCwd ?? env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const childEnv = { ...env, CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_PROJECT_DIR: consumerCwd };
  if (pluginData) {
    childEnv.CLAUDE_PLUGIN_DATA = pluginData;
  } else {
    delete childEnv.CLAUDE_PLUGIN_DATA;
  }
  return {
    pluginRoot,
    pluginData,
    consumerCwd,
    env: childEnv,
    runCommand: overrides.runCommand ?? runCommand,
  };
}

export function listExposedTools() {
  return [...EXPOSED_TOOLS.values()];
}

export function buildToolCommand(toolName, input = {}, context = runtimeContext()) {
  const pluginRoot = context.pluginRoot;
  switch (toolName) {
    case "state_check_project":
      return nodeScript(pluginRoot, "shared/harness/check-state.mjs");
    case "artifact_validate":
      return tsScript(context, validatorScript(pluginRoot, req(input, "validator")), [req(input, "artifactPath")]);
    case "handoff_validate": {
      const args = [req(input, "agentName"), req(input, "handoffPath")];
      const personaId = opt(input, "personaId");
      if (personaId) args.push("--persona", personaId);
      return nodeScript(pluginRoot, "shared/harness/validate-subagent-projection.mjs", args);
    }
    case "collection_run_flow": {
      const args = [req(input, "source"), req(input, "personaId"), req(input, "mode"), opt(input, "query") ?? "", req(input, "runId")];
      const keywordPlanPath = opt(input, "keywordPlanPath");
      if (keywordPlanPath) args.push("--from-keyword-plan", keywordPlanPath);
      return nodeScript(pluginRoot, "shared/collect/run-flow.mjs", args);
    }
    case "collection_select_images":
      return nodeScript(pluginRoot, "shared/collect/select-images.mjs", [req(input, "runId"), req(input, "personaId")]);
    case "collection_screen_images":
      return nodeScript(pluginRoot, "shared/collect/screen-images.mjs", [req(input, "runId"), req(input, "personaId"), req(input, "imagesDir")]);
    case "analysis_close_run": {
      const args = [req(input, "runId")];
      const stateDir = opt(input, "stateDir");
      if (stateDir) args.push(stateDir);
      return nodeScript(pluginRoot, "shared/harness/close-analysis.mjs", args);
    }
    case "analysis_validate_store": {
      const args = [req(input, "personaId")];
      const stateDir = opt(input, "stateDir");
      if (stateDir) args.push(stateDir);
      return tsScript(context, "shared/harness/validate-store.ts", args);
    }
    case "analysis_build_market_position":
      return nodeScript(pluginRoot, "shared/collect/build-market-position.mjs", ["--from-store", req(input, "personaId"), req(input, "outPath")], [req(input, "outPath")]);
    case "generation_normalize_artifact":
      return nodeScript(pluginRoot, "shared/harness/normalize-artifact.mjs", [req(input, "kind"), req(input, "filePath")], [req(input, "filePath")]);
    case "generation_finalize_candidates":
      return tsScript(
        context,
        "shared/harness/finalize-candidates.ts",
        ["--copy", req(input, "copyPath"), "--chatgpt", req(input, "chatgptPath"), "--gemini", req(input, "geminiPath"), "--out", req(input, "outDir")],
        [req(input, "outDir")],
      );
    case "generation_validate_run":
      return tsScript(context, "shared/harness/validate-gen-run.ts", [req(input, "runDir")]);
    case "recipe_serve_viewer":
      return nodeScript(pluginRoot, "shared/collect/validate-recipe.mjs", [req(input, "personaId")]);
    case "report_aggregate_competitive_trend": {
      const args = [req(input, "personaId"), req(input, "runId")];
      const todayIso = opt(input, "todayIso");
      if (todayIso) args.push(todayIso);
      return tsScript(context, "shared/harness/run-competitive-trend.ts", args);
    }
    case "report_render_competitive": {
      const args = [req(input, "trendPath")];
      const outPath = opt(input, "outPath");
      if (outPath) args.push(outPath);
      return nodeScript(pluginRoot, "shared/harness/render-report.mjs", args, outPath ? [outPath] : []);
    }
    case "creative_change_build_snapshot": {
      const args = [req(input, "personaId"), req(input, "runId")];
      const outRunId = opt(input, "outRunId");
      if (outRunId) args.push(outRunId);
      return nodeScript(pluginRoot, "shared/harness/build-creative-snapshot.mjs", args);
    }
    case "creative_change_compare_snapshots": {
      const args = [req(input, "fromSnapshotPath"), req(input, "toSnapshotPath")];
      const outPath = opt(input, "outPath");
      if (outPath) args.push(outPath);
      return nodeScript(pluginRoot, "shared/harness/compare-creative-snapshots.mjs", args, outPath ? [outPath] : []);
    }
    case "creative_change_detect_candidates": {
      const args = [req(input, "diffPath")];
      const outPath = opt(input, "outPath");
      if (outPath) args.push(outPath);
      return nodeScript(pluginRoot, "shared/harness/detect-change-candidates.mjs", args, outPath ? [outPath] : []);
    }
    case "creative_change_render_report": {
      const args = [req(input, "reportPath")];
      const outPath = opt(input, "outPath");
      if (outPath) args.push(outPath);
      return nodeScript(pluginRoot, "shared/harness/render-change-report.mjs", args, outPath ? [outPath] : []);
    }
    default:
      throw new Error(`unknown MCP tool: ${toolName}`);
  }
}

export async function runCommand(file, args, options) {
  return new Promise((resolveResult) => {
    execFile(file, args, { cwd: options.cwd, env: options.env, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const exitCode = typeof error?.code === "number" ? error.code : error ? 1 : 0;
      const finalStderr = stderr || (error ? error.message : "");
      resolveResult({ exitCode, stdout, stderr: finalStderr });
    });
  });
}

export async function callMcpTool(toolName, input = {}, overrides = {}) {
  const context = runtimeContext(overrides);
  if (!EXPOSED_TOOLS.has(toolName)) {
    return {
      ok: false,
      exitCode: 2,
      stdout: "",
      stderr: `unknown MCP tool: ${toolName}`,
      artifacts: [],
    };
  }
  try {
    const command = buildToolCommand(toolName, input, context);
    const result = await context.runCommand(command.file, command.args, {
      cwd: context.consumerCwd,
      env: context.env,
    });
    return {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: truncateText(result.stdout),
      stderr: truncateText(result.stderr),
      artifacts: command.artifacts ?? [],
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: 2,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      artifacts: [],
    };
  }
}
