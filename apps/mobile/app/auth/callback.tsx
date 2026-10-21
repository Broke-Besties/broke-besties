import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

// On web, Google sign-in comes back to this page in a popup; this hands the URL to
// the page that opened it and closes the popup. On iOS/Android it's a no-op.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  return <Redirect href="/" />;
}
