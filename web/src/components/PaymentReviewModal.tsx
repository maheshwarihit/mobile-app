"use client";

import { useEffect, useState } from "react";
import { Check, Ban, FileImage } from "lucide-react";
import {
  useVerifyPayment,
  useRejectPayment,
  money,
  formatDate,
  formatSlot,
  PAYMENT_PROOF_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type BookingWithNames,
} from "@vagewell/shared";
import { supabase } from "@/lib/supabase";
import { Modal, PrimaryButton, OutlineButton, DangerButton, TextareaInput } from "@/components/ui";

/** The caller must key this component on `booking.id` so a fresh instance — with fresh useState defaults — mounts per booking. */
export function PaymentReviewModal({ booking, onClose }: { booking: BookingWithNames | null; onClose: () => void }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const verify = useVerifyPayment();
  const reject = useRejectPayment();

  useEffect(() => {
    if (booking?.payment_proof_path) {
      supabase.storage
        .from(PAYMENT_PROOF_BUCKET)
        .createSignedUrl(booking.payment_proof_path, SIGNED_URL_TTL_SECONDS)
        .then(({ data }) => setSignedUrl(data?.signedUrl ?? null));
    }
  }, [booking?.payment_proof_path]);

  const doVerify = () => booking && verify.mutate(booking.id, { onSuccess: onClose });
  const doReject = () => booking && reject.mutate({ id: booking.id, reason }, { onSuccess: onClose });

  if (!booking) return null;

  return (
    <Modal open={!!booking} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Review Payment</h3>
      </div>

      <div className="mb-4 flex flex-col gap-1.5">
        <Row label="Account" value={booking.account?.full_name ?? "—"} />
        <Row label="Care for" value={booking.subject_name ?? "—"} />
        <Row label="Service" value={booking.service_name} />
        <Row label="When" value={`${formatDate(booking.start_date)} · ${formatSlot(booking.time_slot)} · ${booking.num_days}d`} />
        <Row label="Total" value={money(booking.total_amount)} />
        <Row label="Method" value={booking.payment_method} />
      </div>

      <p className="mb-1.5 text-sm font-medium text-gray-700">Payment proof</p>
      {booking.payment_proof_path ? (
        signedUrl ? (
          <a href={signedUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signedUrl} alt="Payment proof" className="h-64 w-full rounded-lg border border-gray-200 object-contain" />
          </a>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <FileImage size={16} className="text-gray-400" />
            <span className="text-sm text-gray-400">Loading proof…</span>
          </div>
        )
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-500">No screenshot (direct / pay-at-visit).</p>
        </div>
      )}

      {showReject ? (
        <div className="mt-4">
          <TextareaInput
            label="Rejection reason"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Screenshot unclear / amount mismatch"
            rows={2}
            maxLength={500}
          />
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-end gap-2">
        {booking.booking_status === "cancelled" ? (
          <>
            <p className="flex-1 text-xs text-gray-500">This booking was cancelled. Payment can no longer be verified.</p>
            <OutlineButton onClick={onClose}>Close</OutlineButton>
          </>
        ) : !showReject ? (
          <>
            <OutlineButton icon={Ban} onClick={() => setShowReject(true)}>
              Reject
            </OutlineButton>
            <PrimaryButton icon={Check} loading={verify.isPending} onClick={doVerify}>
              Mark Paid
            </PrimaryButton>
          </>
        ) : (
          <>
            <OutlineButton onClick={() => setShowReject(false)}>Back</OutlineButton>
            <DangerButton onClick={doReject}>Confirm Reject</DangerButton>
          </>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="flex-1 text-right text-sm font-medium capitalize text-gray-900">{value}</span>
    </div>
  );
}
