export const ACTIVE_AGENT_IDS = [
  "ad-analyst",
  "ad-creative-refiner",
  "ad-type-classifier",
  "brand-researcher",
  "competitive-analyst",
  "competitor-curator",
  "copy-analyst",
  "copy-layout-planner",
  "creative-brief-analyst",
  "creative-opportunity-mapper",
  "critic-verifier",
  "discovery-scout",
  "image-prompt-adapter",
  "intent-analyst",
  "interview-controller",
  "keyword-planner",
  "layout-analyst",
  "market-context-researcher",
  "orchestrator",
  "pattern-synthesizer",
  "perception-extractor",
  "request-evaluator",
  "strategy-projector",
  "temporal-change-analyst",
  "visual-analyst",
] as const;

export type AgentId = (typeof ACTIVE_AGENT_IDS)[number];

export type ToolPriority = "P0" | "P1";

export type ToolStage =
  | "orchestration"
  | "evaluation"
  | "setup"
  | "collection"
  | "analysis"
  | "generation"
  | "reporting"
  | "lineage"
  | "asset";

export type ToolSideEffect =
  | "read_only"
  | "write_state"
  | "move_files"
  | "serve_localhost"
  | "network_public"
  | "cdp_public_browser"
  | "spawn_chrome"
  | "audit_log";

export type ImplementationKind = "cli" | "module" | "validator-family";

export interface ImplementationRef {
  kind: ImplementationKind;
  path: string;
  command?: string;
  notes?: string;
}

export interface McpExposure {
  exposed: boolean;
  name: string;
  claudeCodeName: string;
}

export interface ToolSpec {
  id: string;
  mcp: McpExposure;
  title: string;
  description: string;
  stage: ToolStage;
  priority: ToolPriority;
  inputSchemaRef: string | null;
  outputSchemaRef: string | null;
  artifactSchemaRefs: readonly string[];
  sideEffects: readonly ToolSideEffect[];
  requiresUserConfirmation: boolean;
  callableBy: readonly AgentId[];
  preconditions: readonly string[];
  failureModes: readonly string[];
  currentImplementation?: ImplementationRef;
}

export const ORCHESTRATOR_ONLY = ["orchestrator"] as const satisfies readonly AgentId[];
export const MCP_SERVER_NAME = "m";
export const CLAUDE_CODE_MCP_PREFIX = "mcp__plugin_marketing-img_m__";

export function mcpTool(id: string, exposed: boolean, name = id): McpExposure {
  return {
    exposed,
    name,
    claudeCodeName: `${CLAUDE_CODE_MCP_PREFIX}${name}`,
  };
}
