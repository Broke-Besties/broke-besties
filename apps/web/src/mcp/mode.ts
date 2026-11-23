export type AgentMode = "v1" | "v2";

/**
 * v1 keeps the original LangGraph flow. v2 routes the assistant through the
 * user-scoped MCP server. Anything other than an explicit "v2" opts keeps the
 * legacy behavior so rolling this out is a one-variable change.
 */
export function getAgentMode(): AgentMode {
  return process.env.AGENT_MODE_VERSION === "v2" ? "v2" : "v1";
}
