// The website's backend reads the Supabase session only from @supabase/ssr's auth cookie,
// so the app sends its session in that same format (base64url, split into 3180-char chunks).
const CHUNK_SIZE = 3180;

function toBase64URL(text: string) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Cookie header value carrying `session` for the Supabase project at `supabaseUrl`. */
export function sessionCookie(supabaseUrl: string, session: object) {
  const name = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  const value = 'base64-' + toBase64URL(JSON.stringify(session));
  if (value.length <= CHUNK_SIZE) return `${name}=${value}`;
  const chunks: string[] = [];
  for (let i = 0; i * CHUNK_SIZE < value.length; i++) {
    chunks.push(`${name}.${i}=${value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)}`);
  }
  return chunks.join('; ');
}
