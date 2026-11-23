import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createBrokeBestiesMcpServer } from "./server";

export type LinkedMcpClient = {
  client: Client;
  close: () => Promise<void>;
};

/**
 * Creates an in-process MCP client/server pair for the agent to use during a
 * single request. The server is scoped to the authenticated user.
 */
export async function createLinkedMcpClient(
  userId: string,
): Promise<LinkedMcpClient> {
  const server = createBrokeBestiesMcpServer({ userId });
  const client = new Client(
    { name: "broke-besties-agent", version: "1.0.0" },
    { capabilities: {} },
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
