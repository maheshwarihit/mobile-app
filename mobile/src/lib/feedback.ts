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

/** Send feedback as the signed-in account (account_id is set by the database). */
export function useSendFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rating, message }: { rating: number; message: string }) => {
      const { error } = await supabase.from("feedback").insert({ rating, message: message.trim() || null });
      if (error) throw error;
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
