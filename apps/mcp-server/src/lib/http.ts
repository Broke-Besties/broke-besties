import { IncomingMessage, ServerResponse } from "node:http";

export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

export function sendHtml(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

export function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { location });
  res.end();
}

export function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function readJsonBody(
  req: IncomingMessage,
  maxBytes = 1024 * 1024,
): Promise<unknown> {
  const body = await readBody(req);
  if (body.length === 0) return undefined;
  if (body.length > maxBytes) throw new HttpError(413, "Request body too large");
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

/** OAuth endpoints take form-encoded bodies; tolerate JSON as a fallback. */
export async function readFormBody(req: IncomingMessage): Promise<Record<string, string>> {
  const body = await readBody(req);
  const contentType = req.headers["content-type"] ?? "";
  if (contentType.includes("application/json")) {
    const parsed: unknown = JSON.parse(body.toString("utf8") || "{}");
    if (parsed === null || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === "string" ? v : String(v),
      ]),
    );
  }
  const params = new URLSearchParams(body.toString("utf8"));
  return Object.fromEntries(params.entries());
}

export function withCors(headers: Record<string, string> = {}): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
    ...headers,
  };
}
