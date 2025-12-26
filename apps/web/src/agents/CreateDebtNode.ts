import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Define your tools
export const getSystemHealth = tool(
  async ({ serviceName }) => {
    // Your logic here
    return `Service ${serviceName} is running optimally.`;
  },
  {
    name: "create_debt",
    description: "Checks the health status of a specific internal service.",
    schema: z.object({
      serviceName: z.string().describe("The name of the service to check"),
    }),
  }
);

// Create the list of tools
export const tools = [getSystemHealth];

// Initialize and export the ToolNode
export const toolNode = new ToolNode(tools);