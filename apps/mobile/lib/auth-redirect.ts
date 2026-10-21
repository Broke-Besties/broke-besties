/** Supabase returns the session in the URL fragment, and errors in the query or the fragment. */
export function tokensFromRedirect(url: string) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.slice(1));
  new URLSearchParams(parsed.search).forEach((value, key) => params.set(key, value));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) {
    throw new Error(params.get('error_description') ?? 'Google sign-in did not finish');
  }
  return { access_token, refresh_token };
}
