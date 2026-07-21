import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key only — never a service-role key here).
 * Session is persisted in cookies via @supabase/ssr so middleware can read it.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy frontend/.env.local.example → .env.local and fill from `supabase status`."
    );
  }
  return createBrowserClient(url, key);
}

let _client: ReturnType<typeof createBrowserClient> | null = null;

/** Shared browser client singleton (used by data hooks). */
export function getSupabase() {
  if (!_client) _client = createClient();
  return _client;
}
