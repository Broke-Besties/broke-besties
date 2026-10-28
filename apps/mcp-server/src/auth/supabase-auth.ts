import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { OAuthStore } from "./oauth-store";

/**
 * Supabase Auth is the upstream IdP: Google SSO (configured at the Supabase
 * level) does the interactive login, then this server exchanges the resulting
 * PKCE code itself — the user's Supabase session never reaches the MCP client.
 */

export type Provider = "google";

function supabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase credentials are not configured");
  }
  return { url, anonKey };
}

/** Map-backed "storage" so the PKCE verifier survives across HTTP requests. */
function sharedStorage(store: OAuthStore) {
  return {
    getItem: (key: string) => store.storageGet(key),
    setItem: (key: string, value: string) => {
      store.storageSet(key, typeof value === "string" ? value : String(value));
    },
    removeItem: (key: string) => {
      store.storageRemove(key);
    },
  };
}

function client(store: OAuthStore): SupabaseClient {
  const { url, anonKey } = supabaseEnv();
  return createClient(url, anonKey, {
    auth: {
      flowType: "pkce",
      storage: sharedStorage(store),
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export interface StartAuthFlowResult {
  authorizeUrl: string;
}

export async function startAuthFlow(
  store: OAuthStore,
  callbackUrl: string,
  provider: Provider = "google",
): Promise<StartAuthFlowResult> {
  const supabase = client(store);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    throw new Error(error?.message ?? "Failed to start authorization flow");
  }
  return { authorizeUrl: data.url };
}

export interface ExchangedUser {
  id: string;
  email: string;
}

export async function exchangeSupabaseCode(
  store: OAuthStore,
  code: string,
): Promise<ExchangedUser> {
  const supabase = client(store);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    throw new Error(error?.message ?? "Authorization code exchange failed");
  }
  const user = data.session.user;
  if (!user?.id) {
    throw new Error("Supabase user lacks an id");
  }
  return { id: user.id, email: user.email ?? "" };
}
