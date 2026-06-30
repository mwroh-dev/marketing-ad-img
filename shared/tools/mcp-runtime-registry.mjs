import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { TOOL_CATALOG } from "./catalog.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PLUGIN_ROOT = resolve(HERE, "../..");

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

export const TOOL_RUNTIME = {
  state_check_project: {
    inputSchema: {},
    buildCommand: (_input, context) => nodeScript(context.pluginRoot, "shared/harness/check-state.mjs"),
  },
  artifact_validate: {
    inputSchema: { validator: z.string(), artifactPath: z.string() },
    buildCommand: (input, context) => tsScript(context, validatorScript(context.pluginRoot, req(input, "validator")), [req(input, "artifactPath")]),
  },
  handoff_validate: {
    inputSchema: { agentName: z.string(), handoffPath: z.string(), personaId: z.string().optional() },
    buildCommand: (input, context) => {
      const args = [req(input, "agentName"), req(input, "handoffPath")];
      const personaId = opt(input, "personaId");
      if (personaId) args.push("--persona", personaId);
      return nodeScript(context.pluginRoot, "shared/harness/validate-subagent-projection.mjs", args);
    },
  },
  collection_run_flow: {
    inputSchema: {
      source: z.string(),
      personaId: z.string(),
      mode: z.string(),
      query: z.string().optional(),
      runId: z.string(),
      keywordPlanPath: z.string().optional(),
    },
    buildCommand: (input, context) => {
      const args = [req(input, "source"), req(input, "personaId"), req(input, "mode"), opt(input, "query") ?? "", req(input, "runId")];
      const keywordPlanPath = opt(input, "keywordPlanPath");
      if (keywordPlanPath) args.push("--from-keyword-plan", keywordPlanPath);
      return nodeScript(context.pluginRoot, "shared/collect/run-flow.mjs", args);
    },
  },
  collection_select_images: {
    inputSchema: { runId: z.string(), personaId: z.string() },
    buildCommand: (input, context) => nodeScript(context.pluginRoot, "shared/collect/select-images.mjs", [req(input, "runId"), req(input, "personaId")]),
  },
  collection_screen_images: {
    inputSchema: { runId: z.string(), personaId: z.string(), imagesDir: z.string() },
    buildCommand: (input, context) =>
      nodeScript(context.pluginRoot, "shared/collect/screen-images.mjs", [req(input, "runId"), req(input, "personaId"), req(input, "imagesDir")]),
  },
  analysis_close_run: {
    inputSchema: { runId: z.string(), stateDir: z.string().optional() },
    buildCommand: (input, context) => {
      const args = [req(input, "runId")];
      const stateDir = opt(input, "stateDir");
      if (stateDir) args.push(stateDir);
      return nodeScript(context.pluginRoot, "shared/harness/close-analysis.mjs", args);
    },
  },
  analysis_validate_store: {
    inputSchema: { personaId: z.string(), stateDir: z.string().optional() },
    buildCommand: (input, context) => {
      const args = [req(input, "personaId")];
      const stateDir = opt(input, "stateDir");
      if (stateDir) args.push(stateDir);
      return tsScript(context, "shared/harness/validate-store.ts", args);
    },
  },
  analysis_build_market_position: {
    inputSchema: { personaId: z.string(), outPath: z.string() },
    buildCommand: (input, context) =>
      nodeScript(
        context.pluginRoot,
        "shared/collect/build-market-position.mjs",
        ["--from-store", req(input, "personaId"), req(input, "outPath")],
        [req(input, "outPath")],
      ),
  },
  generation_normalize_artifact: {
    inputSchema: { kind: z.string(), filePath: z.string() },
    buildCommand: (input, context) =>
      nodeScript(context.pluginRoot, "shared/harness/normalize-artifact.mjs", [req(input, "kind"), req(input, "filePath")], [req(input, "filePath")]),
  },
  generation_finalize_candidates: {
    inputSchema: { copyPath: z.string(), chatgptPath: z.string(), geminiPath: z.string(), outDir: z.string() },
    buildCommand: (input, context) =>
      tsScript(
        context,
        "shared/harness/finalize-candidates.ts",
        ["--copy", req(input, "copyPath"), "--chatgpt", req(input, "chatgptPath"), "--gemini", req(input, "geminiPath"), "--out", req(input, "outDir")],
        [req(input, "outDir")],
      ),
  },
  generation_validate_run: {
    inputSchema: { runDir: z.string() },
    buildCommand: (input, context) => tsScript(context, "shared/harness/validate-gen-run.ts", [req(input, "runDir")]),
  },
  recipe_serve_viewer: {
    inputSchema: { personaId: z.string() },
    buildCommand: (input, context) => nodeScript(context.pluginRoot, "shared/collect/validate-recipe.mjs", [req(input, "personaId")]),
  },
  report_aggregate_competitive_trend: {
    inputSchema: { personaId: z.string(), runId: z.string(), todayIso: z.string().optional() },
    buildCommand: (input, context) => {
      const args = [req(input, "personaId"), req(input, "runId")];
      const todayIso = opt(input, "todayIso");
      if (todayIso) args.push(todayIso);
      return tsScript(context, "shared/harness/run-competitive-trend.ts", args);
    },
  },
  report_render_competitive: {
    inputSchema: { trendPath: z.string(), outPath: z.string().optional() },
    buildCommand: (input, context) => {
      const args = [req(input, "trendPath")];
      const outPath = opt(input, "outPath");
      if (outPath) args.push(outPath);
      return nodeScript(context.pluginRoot, "shared/harness/render-report.mjs", args, outPath ? [outPath] : []);
    },
  },
  creative_change_build_snapshot: {
    inputSchema: { personaId: z.string(), runId: z.string(), outRunId: z.string().optional() },
    buildCommand: (input, context) => {
      const args = [req(input, "personaId"), req(input, "runId")];
      const outRunId = opt(input, "outRunId");
      if (outRunId) args.push(outRunId);
      return nodeScript(context.pluginRoot, "shared/harness/build-creative-snapshot.mjs", args);
    },
  },
  creative_change_compare_snapshots: {
    inputSchema: { fromSnapshotPath: z.string(), toSnapshotPath: z.string(), outPath: z.string().optional() },
    buildCommand: (input, context) => {
      const args = [req(input, "fromSnapshotPath"), req(input, "toSnapshotPath")];
      const outPath = opt(input, "outPath");
      if (outPath) args.push(outPath);
      return nodeScript(context.pluginRoot, "shared/harness/compare-creative-snapshots.mjs", args, outPath ? [outPath] : []);
    },
  },
  creative_change_detect_candidates: {
    inputSchema: { diffPath: z.string(), outPath: z.string().optional() },
    buildCommand: (input, context) => {
      const args = [req(input, "diffPath")];
      const outPath = opt(input, "outPath");
      if (outPath) args.push(outPath);
      return nodeScript(context.pluginRoot, "shared/harness/detect-change-candidates.mjs", args, outPath ? [outPath] : []);
    },
  },
  creative_change_render_report: {
    inputSchema: { reportPath: z.string(), outPath: z.string().optional() },
    buildCommand: (input, context) => {
      const args = [req(input, "reportPath")];
      const outPath = opt(input, "outPath");
      if (outPath) args.push(outPath);
      return nodeScript(context.pluginRoot, "shared/harness/render-change-report.mjs", args, outPath ? [outPath] : []);
    },
  },
};

export function hasRuntimeTool(toolName) {
  return Object.hasOwn(TOOL_RUNTIME, toolName);
}

export function listExposedTools() {
  return [...EXPOSED_TOOLS.values()];
}

export function buildToolCommand(toolName, input = {}, context) {
  const entry = TOOL_RUNTIME[toolName];
  if (!entry) {
    throw new Error(`unknown MCP tool: ${toolName}`);
  }
  if (!context) {
    throw new Error(`missing required runtime context for tool: ${toolName}`);
  }
  return entry.buildCommand(input, context);
}
