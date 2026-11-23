import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { toolDefinitions } from "./tools";
import { errorMessage, type ToolContext } from "./types";

export const MCP_SERVER_INFO = {
  name: "broke-besties",
  version: "1.0.0",
} as const;

export type CreateMcpServerOptions = ToolContext & {
  serverInfo?: { name: string; version: string };
};

/**
 * Builds an MCP server whose tools are scoped to a single authenticated user.
 * Every tool reads the user from this closed-over context, never from client
 * input, so a caller cannot act on another user's data.
 */
export function createBrokeBestiesMcpServer({
  userId,
  serverInfo = MCP_SERVER_INFO,
}: CreateMcpServerOptions) {
  const server = new McpServer(serverInfo);

  for (const definition of toolDefinitions) {
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.schema,
      },
      async (args) => {
        try {
          const result = await definition.handler(
            args as Record<string, unknown>,
            { userId },
          );
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: errorMessage(error),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}
