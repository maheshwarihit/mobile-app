import { useQuery } from "@tanstack/react-query";
import { Linking } from "react-native";
import { SIGNED_URL_TTL_SECONDS } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";

/**
 * Signed URL for a private-bucket object, fetched up front rather than inside
 * a press handler. On native that's just a nicety; on web (this app also ships
 * as a PWA via react-native-web) it's the difference between a working link and
 * a silently swallowed one — `Linking.openURL` becomes `window.open`, and a
 * browser blocks that once an `await` has severed it from the user gesture.
 * The same bug was already fixed twice on the Next.js portal; prefetching here
 * keeps this app from reintroducing it.
 */
export function useSignedUrl(bucket: string, path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", bucket, path ?? "none"],
    enabled: !!path,
    // Refetch well inside the TTL so a long-lived screen never hands out a
    // link that expired while it sat open.
    staleTime: (SIGNED_URL_TTL_SECONDS * 1000) / 2,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path as string, SIGNED_URL_TTL_SECONDS);
      return data?.signedUrl ?? null;
    },
  });
}

/** Open an external URL (signed report, tel:, wa.me). Never throws at the call site. */
export function openUrl(url: string): void {
  void Linking.openURL(url).catch(() => {});
}
