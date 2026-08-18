import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

export type OAuthProvider = "google" | "apple";

/**
 * Google/Apple sign-in via Supabase's hosted OAuth flow — no native SDK
 * (no `@react-native-google-signin/google-signin`, no
 * `expo-apple-authentication`), same one mechanism on both web and native.
 *
 * Requires the provider to actually be configured in the Supabase dashboard
 * (Authentication → Providers) with real credentials from Google Cloud
 * Console / the Apple Developer portal — this function will just surface
 * whatever error Supabase returns if it isn't.
 *
 * On web: a plain redirect. `supabase.auth.signInWithOAuth` sends the
 * browser to the provider, which redirects back to this same origin with the
 * session in the URL fragment — `detectSessionInUrl: true` (lib/supabase.ts)
 * picks it up automatically once the page reloads. Nothing to await here.
 *
 * On native: `skipBrowserRedirect` gets the provider URL without navigating
 * away from the app, `expo-web-browser` opens it in an in-app browser
 * session, and the result is parsed for the tokens Supabase appended to the
 * redirect (`vagewell://` — app.json's `scheme`) — `setSession()` then
 * establishes the session the same way verifyOtp() normally would.
 */
export async function signInWithProvider(
  provider: OAuthProvider,
  requestedRole?: string
): Promise<{ error: string | null }> {
  const roleParam = requestedRole ? { requested_role: requestedRole } : undefined;

  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin, queryParams: roleParam },
    });
    return { error: error?.message ?? null };
  }

  const redirectUrl = Linking.createURL("/");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true, queryParams: roleParam },
  });
  if (error || !data.url) return { error: error?.message ?? "Could not start sign-in." };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
  if (result.type !== "success") {
    return result.type === "cancel" || result.type === "dismiss" ? { error: null } : { error: "Sign-in was interrupted." };
  }

  const parsedResult = Linking.parse(result.url);
  const resultQueryParams = parsedResult.queryParams as Record<string, string> | null;
  if (resultQueryParams?.error) return { error: resultQueryParams.error_description ?? "Sign-in failed." };

  // Supabase's implicit OAuth flow appends tokens after a `#`, not as `?`
  // query params — expo-linking's own parser only reads the query string, so
  // the fragment is parsed by hand here.
  const hash = result.url.split("#")[1];
  const fragment = new URLSearchParams(hash ?? "");
  const access_token = fragment.get("access_token");
  const refresh_token = fragment.get("refresh_token");
  if (!access_token || !refresh_token) return { error: "No session returned from sign-in." };

  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  return { error: sessionError?.message ?? null };
}
