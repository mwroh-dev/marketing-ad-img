import { TOOL_DEFINITIONS } from "./definitions.js";

export {
  ACTIVE_AGENT_IDS,
  CLAUDE_CODE_MCP_PREFIX,
  MCP_SERVER_NAME,
  ORCHESTRATOR_ONLY,
  mcpTool,
} from "./types.js";

export type {
  AgentId,
  ImplementationKind,
  ImplementationRef,
  McpExposure,
  ToolPriority,
  ToolSideEffect,
  ToolSpec,
  ToolStage,
} from "./types.js";

export const TOOL_CATALOG = TOOL_DEFINITIONS;

export type ToolId = (typeof TOOL_CATALOG)[number]["id"];
