import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import { callMcpTool } from "./mcp-handlers.mjs";
import { TOOL_RUNTIME, listExposedTools } from "./mcp-runtime-registry.mjs";

export function listMcpToolDefinitions() {
  return listExposedTools().map((tool) => ({
    name: tool.mcp.name,
    title: tool.title,
    description: tool.description,
    inputSchema: TOOL_RUNTIME[tool.mcp.name]?.inputSchema ?? {},
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
  for (const tool of listExposedTools()) {
    server.registerTool(
      tool.mcp.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: TOOL_RUNTIME[tool.mcp.name]?.inputSchema ?? {},
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
