import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase, toast, type ProofSource } from "./runtime";
import { qk } from "./queryClient";
import {
  PAYMENT_PROOF_BUCKET,
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  MEDICAL_REPORT_BUCKET,
  ALLOWED_REPORT_MIME,
  MAX_REPORT_UPLOAD_BYTES,
} from "./constants";
import type { Role, ServiceMode, ReportType } from "./types";

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

// ── Assignment pipeline (admin approve/assign, assigned member run-the-visit) ──

/** Admin approves a `requested` booking and picks Clinic Visit vs Home Care. */
export function useApproveBooking() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, serviceMode }: { id: string; serviceMode: ServiceMode }) => {
      const { error } = await getSupabase()
        .from("bookings")
        .update({ service_mode: serviceMode, booking_status: "approved" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.bookings("all")]);
      toast.success("Booking approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Admin assigns a staff (clinic) or leaf_node (home care) member. `serviceMode`
 * is optional — pass it to jump straight from `requested` to `assigned` in one
 * step; omit it when the booking was already approved separately.
 */
export function useAssignBooking() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      assignedTo,
      serviceMode,
    }: {
      id: string;
      assignedTo: string;
      serviceMode?: ServiceMode;
    }) => {
      const payload: Record<string, unknown> = { assigned_to: assignedTo, booking_status: "assigned" };
      if (serviceMode) payload.service_mode = serviceMode;
      const { error } = await getSupabase().from("bookings").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.bookings("all")]);
      toast.success("Booking assigned");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Assigned staff/leaf_node member marks a visit as started (assigned → in_progress). */
export function useStartVisit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("bookings").update({ booking_status: "in_progress" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.bookings("assigned"), qk.bookings("all")]);
      toast.success("Visit started");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Assigned member (or admin) closes out a visit — from in_progress or report_uploaded. */
export function useCompleteVisit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("bookings").update({ booking_status: "completed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.bookings("assigned"), qk.bookings("all"), qk.bookings("mine")]);
      toast.success("Visit completed");
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
    // `source` is platform-neutral (see ProofSource): web wraps a File, mobile
    // wraps an image-picker asset. Both yield an ArrayBuffer for the upload.
    mutationFn: async ({ bookingId, userId, source }: { bookingId: string; userId: string; source: ProofSource }) => {
      if (!ALLOWED_IMAGE_MIME.includes(source.contentType as (typeof ALLOWED_IMAGE_MIME)[number]))
        throw new Error("Please upload a PNG, JPG, or WEBP image.");
      if (source.sizeBytes > MAX_UPLOAD_BYTES) throw new Error("File exceeds the 5 MB limit.");
      const sb = getSupabase();
      const ext = source.contentType === "image/png" ? "png" : source.contentType === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${bookingId}/${Date.now()}.${ext}`;
      const body = await source.toArrayBuffer();
      const { error: upErr } = await sb.storage
        .from(PAYMENT_PROOF_BUCKET)
        .upload(path, body, { contentType: source.contentType, upsert: true });
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

// ── Reports (staff/leaf_node upload; admin releases to the customer) ────────
export function useUploadReport() {
  const invalidate = useInvalidate();
  return useMutation({
    // `source` is platform-neutral (see ProofSource): web wraps a File, mobile
    // wraps an image-picker/document-picker asset.
    mutationFn: async ({
      bookingId,
      reportType,
      note,
      source,
    }: {
      bookingId: string;
      reportType: ReportType;
      note: string;
      source: ProofSource;
    }) => {
      if (!ALLOWED_REPORT_MIME.includes(source.contentType as (typeof ALLOWED_REPORT_MIME)[number]))
        throw new Error("Please upload a PNG, JPG, WEBP, or PDF file.");
      if (source.sizeBytes > MAX_REPORT_UPLOAD_BYTES) throw new Error("File exceeds the 10 MB limit.");
      const sb = getSupabase();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const ext =
        source.contentType === "application/pdf"
          ? "pdf"
          : source.contentType === "image/png"
            ? "png"
            : source.contentType === "image/webp"
              ? "webp"
              : "jpg";
      const path = `${bookingId}/${user.id}/${Date.now()}.${ext}`;
      const body = await source.toArrayBuffer();
      const { error: upErr } = await sb.storage
        .from(MEDICAL_REPORT_BUCKET)
        .upload(path, body, { contentType: source.contentType, upsert: true });
      if (upErr) throw upErr;
      const { error } = await sb
        .from("report_uploads")
        .insert({ booking_id: bookingId, report_type: reportType, storage_path: path, note: note || null });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      invalidate([qk.reports(vars.bookingId), qk.bookings("assigned"), qk.bookings("all")]);
      toast.success("Report uploaded — awaiting admin release to the customer");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Admin releases an uploaded report to the customer. */
export function useReviewReport() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc("review_report", { p_report: id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.reportsUnreviewed, ["reports", "__mine__"] as const]);
      toast.success("Report released to the customer");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Booking requests — "Request for Booking" (customer) + admin inbox ────────
/** Customer sends a quick "contact me about booking" lead — no service/date needed. */
export function useCreateBookingRequest() {
  return useMutation({
    mutationFn: async (note?: string) => {
      // account_id is stamped server-side from auth.uid() (tg_booking_request_stamp
      // runs BEFORE INSERT, ahead of the NOT NULL check) — not sent from the client,
      // same pattern as report_uploads.uploaded_by.
      const { error } = await getSupabase()
        .from("booking_requests")
        .insert({ note: note || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent — our team will contact you shortly.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Admin marks a booking request as contacted (removes it from the open inbox). */
export function useMarkRequestContacted() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc("mark_request_contacted", { p_request: id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate([qk.bookingRequests]);
      toast.success("Marked as contacted");
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
