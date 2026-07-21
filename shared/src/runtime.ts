/**
 * Runtime dependency-injection seam.
 *
 * The data layer (hooks.ts / mutations.ts) is shared verbatim between the Next.js
 * web app and the Expo mobile app. Neither the Supabase client nor the toast
 * implementation can be imported directly here — the web uses @supabase/ssr +
 * sonner, mobile uses @supabase/supabase-js + sonner-native. Each app calls
 * `configureCore()` once at startup to inject its own implementations; the shared
 * code only ever reaches them through `getSupabase()` and `toast`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

/**
 * Platform-neutral payment-proof source. The web wraps a browser `File`; mobile
 * wraps an `expo-image-picker` asset. Both expose the bytes as an ArrayBuffer so
 * the shared upload mutation never touches a DOM `File` type (keeps the package
 * free of the `dom` lib for React Native).
 */
export interface ProofSource {
  contentType: string; // "image/png" | "image/jpeg" | "image/webp"
  sizeBytes: number;
  toArrayBuffer: () => Promise<ArrayBuffer>;
}

let _supabase: SupabaseClient | null = null;
let _toast: ToastApi = {
  success: () => {},
  error: () => {},
};

export function configureCore(opts: { supabase: SupabaseClient; toast: ToastApi }): void {
  _supabase = opts.supabase;
  _toast = opts.toast;
}

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error(
      "Supabase client not configured — call configureCore({ supabase, toast }) at app startup before using any hook/mutation."
    );
  }
  return _supabase;
}

export const toast: ToastApi = {
  success: (m) => _toast.success(m),
  error: (m) => _toast.error(m),
};
