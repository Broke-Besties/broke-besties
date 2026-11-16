import { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { packageVersion } from "../version";
import { readJsonBody } from "../lib/http";
import { buildToolRegistrations, type ToolContext } from "./tools";

/**
 * Stateless Streamable HTTP transport: a fresh server + transport per request
 * (MCP spec's "stateless" mode). `Authorization` was already validated by the
 * bearer gate before the transport sees the message.
 */

export function createMcpServerForUser(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "broke-besties", version: packageVersion });
  const tools = buildToolRegistrations(ctx);
  for (const [name, tool] of Object.entries(tools)) {
    server.registerTool(name, {
      title: name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, (args, extra) => tool.execute(args, extra));
  }
  return server;
}

export async function handleMcpPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ToolContext,
): Promise<void> {
  const server = createMcpServerForUser(ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  const body = await readJsonBody(req);
  await transport.handleRequest(req, res, body);
}
