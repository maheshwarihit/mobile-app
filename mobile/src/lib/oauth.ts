import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { supabase } from "./supabase";

export type OAuthProvider = "google";

/**
 * Google sign-in. Two different mechanisms depending on platform:
 *
 * - **Web** (browser/PWA): Supabase's hosted OAuth redirect — a plain
 *   redirect to Google, which redirects back to this origin with the
 *   session in the URL fragment (`detectSessionInUrl: true`, lib/supabase.ts,
 *   picks it up automatically). This is the only option on web; it always
 *   shows Google's consent screen labelled with the raw Supabase project
 *   domain ("to continue to <ref>.supabase.co"), since the redirect lands on
 *   a domain this app doesn't own — that's Google's own anti-spoofing
 *   behavior, not fixable without a custom Supabase Auth domain.
 *
 * - **Native** (real Android/iOS app builds): the native Google Sign-In SDK
 *   (`@react-native-google-signin/google-signin`) instead — this drives the
 *   device's own account picker (app icon + app name, no domain shown at
 *   all, since there's no web redirect involved) and hands the resulting ID
 *   token straight to `supabase.auth.signInWithIdToken()`. Requires:
 *     1. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set to the same "Web application"
 *        OAuth Client ID already configured in Supabase's Google provider —
 *        Supabase verifies the ID token's `aud` claim against that Client ID,
 *        so it must be the Web one, not the native Android/iOS client below.
 *     2. A separate native OAuth Client registered in Google Cloud Console
 *        per platform (Android: package name `in.vagewell.care` + the
 *        signing certificate's SHA-1 fingerprint; iOS: bundle identifier) —
 *        these exist purely so Google can verify which real app is asking,
 *        they're never referenced directly in this app's code/config.
 *     3. An actual native build (`eas build`) — this SDK has no native
 *        module in Expo Go or a plain web export.
 *
 * (Apple was removed — Google alone covers the "sign in with an email
 * account" convenience this app wants; every account, however it started,
 * still ends up phone-verified — see VerifyPhoneScreen.tsx.)
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<{ error: string | null }> {
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  }

  return nativeGoogleSignIn();
}

let googleConfigured = false;
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — set it to the Google OAuth 'Web application' Client ID already configured in Supabase's Google provider."
    );
  }
  GoogleSignin.configure({ webClientId });
  googleConfigured = true;
}

async function nativeGoogleSignIn(): Promise<{ error: string | null }> {
  ensureGoogleConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== "success") return { error: null }; // user cancelled the picker
    const idToken = response.data.idToken;
    if (!idToken) return { error: "Google did not return an ID token." };
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Google sign-in failed." };
  }
}
