import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Send feedback as the signed-in account (account_id is set by the database).
 * It is stored only in the backend (Supabase → feedback table, migration 0052);
 * nobody reads it inside the app.
 */
export function useSendFeedback() {
  return useMutation({
    mutationFn: async ({ rating, message }: { rating: number; message: string }) => {
      const { error } = await supabase.from("feedback").insert({ rating, message: message.trim() || null });
      if (error) throw error;
    },
  });
}
