import { z } from "zod";

export type ToolContext = {
  userId: string;
};

export type McpToolDefinition = {
  name: string;
  title: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (
    args: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<unknown>;
};

export function defineTool<Shape extends z.ZodRawShape>(definition: {
  name: string;
  title: string;
  description: string;
  schema: Shape;
  handler: (
    args: z.infer<z.ZodObject<Shape>>,
    context: ToolContext,
  ) => Promise<unknown>;
}): McpToolDefinition {
  return definition as unknown as McpToolDefinition;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
