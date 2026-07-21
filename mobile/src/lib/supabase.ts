import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy mobile/.env.example → mobile/.env and fill from your Supabase project."
  );
}

/**
 * expo-secure-store encrypts at rest (Android Keystore) but caps each value at
 * ~2 KB. A Supabase session (access JWT + refresh token + user) is larger, so we
 * split it across `${key}.0`, `${key}.1`, … and store a `__chunks__:N` marker at
 * the base key. Small values are stored directly. This is the standard
 * Supabase-on-React-Native secure-storage pattern.
 */
const CHUNK_SIZE = 1800;
const MARKER = "__chunks__:";

const chunkedSecureStore = {
  getItem: async (key: string): Promise<string | null> => {
    const head = await SecureStore.getItemAsync(key);
    if (head == null) return null;
    if (!head.startsWith(MARKER)) return head;
    const count = parseInt(head.slice(MARKER.length), 10);
    let out = "";
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null; // corrupt/partial → treat as missing
      out += part;
    }
    return out;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await clearChunks(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(key, `${MARKER}${count}`);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
  },
  removeItem: async (key: string): Promise<void> => {
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};

async function clearChunks(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key);
  if (head && head.startsWith(MARKER)) {
    const count = parseInt(head.slice(MARKER.length), 10);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // SecureStore is native-only. On web (browser preview) fall back to the
    // Supabase default (localStorage) so the session can load.
    storage: Platform.OS === "web" ? undefined : chunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no OTP redirect callback on mobile
  },
});

// Refresh the session only while the app is foregrounded (Supabase RN guidance).
// Not needed on web, where the browser tab visibility handling covers it.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
