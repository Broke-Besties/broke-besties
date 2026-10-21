import { createServerClient } from '@supabase/ssr'
import {
  createClient as createJsClient,
  isAuthRetryableFetchError,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Admin client with service role key for server-side operations
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op for admin client
        },
      },
    }
  )
}

// Stateless client for verifying mobile JWTs (no session, no refresh). Built on the
// first Bearer request because createClient throws when the env vars are missing
// (tests, `next build`).
let tokenVerifier: SupabaseClient | null = null

function getTokenVerifier() {
  if (!tokenVerifier) {
    tokenVerifier = createJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    )
  }
  return tokenVerifier
}

async function getBearerToken(): Promise<string | null> {
  try {
    const value = (await headers()).get('authorization')
    if (!value || !/^bearer\s+/i.test(value)) return null
    return value.replace(/^bearer\s+/i, '').trim() || null
  } catch {
    return null // called outside a request scope
  }
}

export async function getUser() {
  const token = await getBearerToken()
  if (token) {
    // A rejected token must not fall back to cookies: the mobile client
    // refreshes its session on 401 and retries.
    const { data: { user }, error } = await getTokenVerifier().auth.getUser(token)
    // Supabase unreachable is not a bad token: a 401 would make the app sign out.
    if (isAuthRetryableFetchError(error)) throw error
    return error || !user ? null : user
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}
