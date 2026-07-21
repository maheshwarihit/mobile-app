"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { qk } from "@/lib/queryClient";
import { PAYMENT_PROOF_BUCKET, ALLOWED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "@shared/constants";
import type { Role } from "@shared/types";

function useInvalidate() {
  const qc = useQueryClient();
  return (keys: readonly (readonly unknown[])[]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
}

// ── Bookings ─────────────────────────────────────────────────────
export function useCancelBooking() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("bookings")
        .update({ booking_status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.bookings("mine"), qk.bookings("all")]);
      toast.success("Appointment cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVerifyPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc("verify_payment", { p_booking: id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.bookings("all"), qk.bookings("mine")]);
      toast.success("Payment marked as paid");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await getSupabase().rpc("reject_payment", { p_booking: id, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.bookings("all"), qk.bookings("mine")]);
      toast.success("Payment rejected — patient can re-upload proof");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReuploadProof() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ bookingId, userId, file }: { bookingId: string; userId: string; file: File }) => {
      if (!ALLOWED_IMAGE_MIME.includes(file.type as (typeof ALLOWED_IMAGE_MIME)[number]))
        throw new Error("Please upload a PNG, JPG, or WEBP image.");
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("File exceeds the 5 MB limit.");
      const sb = getSupabase();
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${bookingId}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from(PAYMENT_PROOF_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { error } = await sb.from("bookings").update({ payment_proof_path: path }).eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.bookings("mine"), qk.bookings("all")]);
      toast.success("Proof re-uploaded — awaiting verification");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Dependents ───────────────────────────────────────────────────
export function useSaveDependent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      account_id: string;
      full_name: string;
      age: number | null;
      relationship: string;
      contact_phone: string | null;
      gender: string | null;
    }) => {
      const sb = getSupabase();
      if (payload.id) {
        const { id, account_id: _a, ...rest } = payload;
        void _a;
        const { error } = await sb.from("family_members").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { id: _i, ...rest } = payload;
        void _i;
        const { error } = await sb.from("family_members").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate([qk.familyMembers]);
      toast.success("Dependent saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDependent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("family_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.familyMembers]);
      toast.success("Dependent removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Profile bio ──────────────────────────────────────────────────
export function useUpdateProfile() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      full_name: string;
      age: number | null;
      date_of_birth: string | null;
      gender: string | null;
    }) => {
      const { id, ...rest } = payload;
      const { error } = await getSupabase().from("profiles").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.profile]);
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Clinical vitals (staff/admin) ────────────────────────────────
export function useAddClinical() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await getSupabase().from("clinical_records").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinical"] });
      invalidate([]);
      toast.success("Vitals recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Admin: role management ───────────────────────────────────────
export function useSetUserRole() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error } = await getSupabase().rpc("set_user_role", { p_user: userId, p_role: role });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.users]);
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
