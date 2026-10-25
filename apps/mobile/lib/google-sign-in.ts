import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { tokensFromRedirect } from '@/lib/auth-redirect';
import { supabase } from '@/lib/supabase';

/**
 * Google sign-in through Supabase, in the system auth browser.
 * Resolves false when the person closes the browser without finishing.
 */
export async function signInWithGoogle(): Promise<boolean> {
  // exp://<host>/--/auth/callback in Expo Go, mobile://auth/callback in a build.
  // Must be in Supabase's redirect allow-list, or Supabase sends people to the website.
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const { error: sessionError } = await supabase.auth.setSession(tokensFromRedirect(result.url));
  if (sessionError) throw sessionError;
  return true;
}
