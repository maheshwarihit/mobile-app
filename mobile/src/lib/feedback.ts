import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** One piece of patient feedback (migration 0052), with who sent it for the admin's list. */
export type Feedback = {
  id: string;
  account_id: string;
  rating: number;
  message: string | null;
  created_at: string;
  account?: { full_name: string | null; phone: string | null } | null;
};

const FEEDBACK_KEY = ["feedback", "all"] as const;

/**
 * Send feedback as the signed-in account. Goes through the send-feedback
 * function, which saves it and emails it to info@vagewell.com; if that
 * function is not deployed yet, it is saved directly (no email).
 */
export function useSendFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rating, message }: { rating: number; message: string }) => {
      const { data, error } = await supabase.functions.invoke("send-feedback", { body: { rating, message } });
      if (!error && (data as { saved?: boolean } | null)?.saved) return;
      // 404 / network: the function isn't deployed — save without the email.
      const status = (error as { context?: { status?: number } } | null)?.context?.status;
      if (error && status !== 404 && status !== undefined) throw error;
      const { error: insertError } = await supabase.from("feedback").insert({ rating, message: message.trim() || null });
      if (insertError) throw insertError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FEEDBACK_KEY }),
  });
}

/** Admin: every patient's feedback, newest first (RLS shows a patient only their own). */
export function useAllFeedback(enabled: boolean) {
  return useQuery({
    queryKey: FEEDBACK_KEY,
    enabled,
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*, account:profiles!feedback_account_id_fkey(full_name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Feedback[];
    },
  });
}

/** Admin: remove one piece of feedback. */
export function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feedback").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FEEDBACK_KEY }),
  });
}
