import { execFile } from "node:child_process";
import { buildToolCommand as buildRuntimeToolCommand, DEFAULT_PLUGIN_ROOT, hasRuntimeTool } from "./mcp-runtime-registry.mjs";
export { listExposedTools } from "./mcp-runtime-registry.mjs";

export const OUTPUT_CHAR_LIMIT = 6000;

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

export function buildToolCommand(toolName, input = {}, context = runtimeContext()) {
  return buildRuntimeToolCommand(toolName, input, context);
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
  if (!hasRuntimeTool(toolName)) {
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
