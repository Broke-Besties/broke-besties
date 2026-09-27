import {
  AUTH_CODE_TTL_MS,
  AUTH_FLOW_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  SHARED_STORAGE_TTL_MS,
} from "../config";
import { hashToken } from "../lib/tokens";

/**
 * In-memory OAuth state store.
 *
 * Holds registered clients, pending authorization flows, single-use auth
 * codes, refresh tokens (hashed) and a shared KV space used as the Supabase
 * PKCE "storage" so verifier state survives across HTTP requests of one flow.
 *
 * MVP scope: single-process. Swap for Redis in a multi-instance deployment
 * (see spec "Future work").
 */

export interface RegisteredClient {
  clientId: string;
  clientName?: string;
  redirectUris: string[];
  createdAt: number;
}

export interface AuthCodeRecord {
  clientId: string;
  userId: string;
  email: string;
  redirectUri: string;
  codeChallenge: string; // S256 challenge
  resource: string;
  scope: string;
  expiresAt: number;
}

export interface AuthFlowContext {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  resource: string;
  expiresAt: number;
}

export interface RefreshTokenRecord {
  userId: string;
  email: string;
  clientId: string;
  expiresAt: number;
}

export interface RegisterClientInput {
  clientName?: string;
  redirectUris: string[];
}

export function isAcceptableRedirectUri(rawUri: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUri);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  // RFC 8252: loopback IP redirects may use http with any port.
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return true;
  }
  return false;
}

export class OAuthStore {
  private clients = new Map<string, RegisteredClient>();
  private authCodes = new Map<string, AuthCodeRecord>();
  private authFlows = new Map<string, AuthFlowContext>();
  private refreshTokens = new Map<string, RefreshTokenRecord>();
  private storage = new Map<string, { value: string; expiresAt: number }>();

  registerClient(input: RegisterClientInput, clientId?: string): RegisteredClient {
    for (const uri of input.redirectUris) {
      if (!isAcceptableRedirectUri(uri)) {
        throw new Error(`redirect_uri is not acceptable: ${uri}`);
      }
    }
    if (input.redirectUris.length === 0) {
      throw new Error("At least one redirect_uri is required");
    }
    const id = clientId ?? crypto.randomUUID();
    const client: RegisteredClient = {
      clientId: id,
      clientName: input.clientName,
      redirectUris: [...input.redirectUris],
      createdAt: Date.now(),
    };
    this.clients.set(id, client);
    return client;
  }

  getClient(clientId: string): RegisteredClient | null {
    return this.clients.get(clientId) ?? null;
  }

  createAuthCode(
    record: Omit<AuthCodeRecord, "expiresAt">,
    now = Date.now(),
  ): string {
    const code = crypto.randomUUID() + crypto.randomUUID();
    this.authCodes.set(code, { ...record, expiresAt: now + AUTH_CODE_TTL_MS });
    return code;
  }

  /** Single-use: returns the record once, then the code is dead. */
  consumeAuthCode(code: string, now = Date.now()): AuthCodeRecord | null {
    const record = this.authCodes.get(code);
    this.authCodes.delete(code);
    if (!record) return null;
    if (record.expiresAt <= now) return null;
    return record;
  }

  createAuthFlow(
    context: Omit<AuthFlowContext, "expiresAt">,
    now = Date.now(),
  ): string {
    const id = crypto.randomUUID();
    this.authFlows.set(id, { ...context, expiresAt: now + AUTH_FLOW_TTL_MS });
    return id;
  }

  getAuthFlow(id: string, now = Date.now()): AuthFlowContext | null {
    const context = this.authFlows.get(id);
    if (!context) return null;
    if (context.expiresAt <= now) {
      this.authFlows.delete(id);
      return null;
    }
    return context;
  }

  deleteAuthFlow(id: string): void {
    this.authFlows.delete(id);
  }

  createRefreshToken(
    record: Omit<RefreshTokenRecord, "expiresAt">,
    now = Date.now(),
  ): string {
    const token = crypto.randomUUID() + crypto.randomUUID();
    this.refreshTokens.set(hashToken(token), {
      ...record,
      expiresAt: now + REFRESH_TOKEN_TTL_MS,
    });
    return token;
  }

  /**
   * Validates + rotates a refresh token: the old token is revoked and a
   * fresh one returned. Reuse of an already-rotated token fails.
   */
  rotateRefreshToken(token: string, now = Date.now()): RefreshTokenRecord | null {
    const key = hashToken(token);
    const record = this.refreshTokens.get(key);
    this.refreshTokens.delete(key); // always revoke the presented token
    if (!record) return null;
    if (record.expiresAt <= now) return null;
    return record;
  }

  // Supabase-js storage adapter (shared KV, used for the PKCE code verifier)
  storageGet(key: string, now = Date.now()): string | null {
    const entry = this.storage.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.storage.delete(key);
      return null;
    }
    if (typeof entry.value !== "string") return entry.value;
    return entry.value;
  }

  storageSet(key: string, value: string, now = Date.now()): void {
    this.storage.set(key, { value, expiresAt: now + SHARED_STORAGE_TTL_MS });
  }

  storageRemove(key: string): void {
    this.storage.delete(key);
  }

  sweep(now = Date.now()): void {
    for (const [code, record] of this.authCodes) {
      if (record.expiresAt <= now) this.authCodes.delete(code);
    }
    for (const [id, context] of this.authFlows) {
      if (context.expiresAt <= now) this.authFlows.delete(id);
    }
    for (const [key, record] of this.refreshTokens) {
      if (record.expiresAt <= now) this.refreshTokens.delete(key);
    }
    for (const [key, entry] of this.storage) {
      if (entry.expiresAt <= now) this.storage.delete(key);
    }
  }
}

export function startSweeper(store: OAuthStore, intervalMs = 60_000): () => void {
  const timer = setInterval(() => store.sweep(), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
