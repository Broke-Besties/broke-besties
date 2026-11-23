export const config = {
  port: Number(process.env.PORT ?? 8082),
  baseUrl: (process.env.MCP_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8082}`).replace(/\/+$/, ""),
  defaultAudience: "broke-besties-mcp",
  scope: "mcp",
} as const;

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const AUTH_FLOW_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const SHARED_STORAGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function loadConfig() {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL)
    missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    missing.push("SUPABASE_ANON_KEY");
  if (!process.env.MCP_JWT_SECRET) missing.push("MCP_JWT_SECRET");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  return config;
}
