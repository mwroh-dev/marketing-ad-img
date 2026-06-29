import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import { TOOL_CATALOG } from "./catalog.ts";
import { callMcpTool, listExposedTools } from "./mcp-handlers.mjs";

const TOOL_INPUT_SCHEMAS = {
  state_check_project: {},
  artifact_validate: { validator: z.string(), artifactPath: z.string() },
  handoff_validate: { agentName: z.string(), handoffPath: z.string(), personaId: z.string().optional() },
  collection_run_flow: { source: z.string(), personaId: z.string(), mode: z.string(), query: z.string().optional(), runId: z.string(), keywordPlanPath: z.string().optional() },
  collection_select_images: { runId: z.string(), personaId: z.string() },
  collection_screen_images: { runId: z.string(), personaId: z.string(), imagesDir: z.string() },
  analysis_close_run: { runId: z.string(), stateDir: z.string().optional() },
  analysis_validate_store: { personaId: z.string(), stateDir: z.string().optional() },
  analysis_build_market_position: { personaId: z.string(), outPath: z.string() },
  generation_normalize_artifact: { kind: z.string(), filePath: z.string() },
  generation_finalize_candidates: { copyPath: z.string(), chatgptPath: z.string(), geminiPath: z.string(), outDir: z.string() },
  generation_validate_run: { runDir: z.string() },
  recipe_serve_viewer: { personaId: z.string() },
  report_aggregate_competitive_trend: { personaId: z.string(), runId: z.string(), todayIso: z.string().optional() },
  report_render_competitive: { trendPath: z.string(), outPath: z.string().optional() },
  creative_change_build_snapshot: { personaId: z.string(), runId: z.string(), outRunId: z.string().optional() },
  creative_change_compare_snapshots: { fromSnapshotPath: z.string(), toSnapshotPath: z.string(), outPath: z.string().optional() },
  creative_change_detect_candidates: { diffPath: z.string(), outPath: z.string().optional() },
  creative_change_render_report: { reportPath: z.string(), outPath: z.string().optional() },
};

export function listMcpToolDefinitions() {
  return listExposedTools().map((tool) => ({
    name: tool.mcp.name,
    title: tool.title,
    description: tool.description,
    inputSchema: TOOL_INPUT_SCHEMAS[tool.mcp.name] ?? {},
  }));
}

export async function callMcpToolForServer(name, args, overrides = {}) {
  const result = await callMcpTool(name, args, overrides);
  return {
    isError: !result.ok,
    content: [
      {
        type: "text",
        text: JSON.stringify(result),
      },
    ],
  };
}

export function createServer(overrides = {}) {
  const server = new McpServer({
    name: "marketing-img",
    version: "0.1.0-alpha",
  });
  for (const tool of TOOL_CATALOG.filter((candidate) => candidate.priority === "P0" && candidate.mcp.exposed)) {
    server.registerTool(
      tool.mcp.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: TOOL_INPUT_SCHEMAS[tool.mcp.name] ?? {},
      },
      async (args) => callMcpToolForServer(tool.mcp.name, args, overrides),
    );
  }
  return server;
}

export async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function isEntrypoint() {
  if (!process.argv[1]) return false;
  return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
}

if (isEntrypoint()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
