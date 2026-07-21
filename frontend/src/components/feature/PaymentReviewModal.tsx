"use client";

import { useEffect, useState } from "react";
import { X, Check, Ban, FileImage } from "lucide-react";
import { PrimaryButton, DangerButton, OutlineButton, TextareaInput } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { useVerifyPayment, useRejectPayment } from "@/lib/mutations";
import { money } from "@/lib/format";
import { formatDate, formatSlot } from "@/lib/dates";
import { PAYMENT_PROOF_BUCKET, SIGNED_URL_TTL_SECONDS } from "@shared/constants";
import type { BookingWithNames } from "@shared/types";

export function PaymentReviewModal({
  booking,
  onClose,
}: {
  booking: BookingWithNames | null;
  onClose: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const verify = useVerifyPayment();
  const reject = useRejectPayment();

  useEffect(() => {
    setSignedUrl(null);
    setReason("");
    setShowReject(false);
    if (booking?.payment_proof_path) {
      getSupabase()
        .storage.from(PAYMENT_PROOF_BUCKET)
        .createSignedUrl(booking.payment_proof_path, SIGNED_URL_TTL_SECONDS)
        .then(({ data }) => setSignedUrl(data?.signedUrl ?? null));
    }
  }, [booking]);

  if (!booking) return null;

  const doVerify = () => verify.mutate(booking.id, { onSuccess: onClose });
  const doReject = () =>
    reject.mutate({ id: booking.id, reason }, { onSuccess: onClose });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Review Payment</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <dl className="mb-4 space-y-1.5 text-sm">
          <Row label="Account" value={booking.account?.full_name ?? "—"} />
          <Row label="Care for" value={booking.subject_name ?? "—"} />
          <Row label="Service" value={booking.service_name} />
          <Row label="When" value={`${formatDate(booking.start_date)} · ${formatSlot(booking.time_slot)} · ${booking.num_days}d`} />
          <Row label="Total" value={money(booking.total_amount)} />
          <Row label="Method" value={booking.payment_method} />
        </dl>

        <div className="mb-4">
          <p className="mb-1.5 text-sm font-medium text-gray-700">Payment proof</p>
          {booking.payment_proof_path ? (
            signedUrl ? (
              <a href={signedUrl} target="_blank" rel="noreferrer">
                <img src={signedUrl} alt="Payment proof" className="max-h-64 w-full rounded-lg border border-gray-200 object-contain" />
              </a>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-400">
                <FileImage size={16} /> Loading proof…
              </div>
            )
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              No screenshot (direct / pay-at-visit).
            </div>
          )}
        </div>

        {showReject && (
          <div className="mb-4">
            <TextareaInput
              label="Rejection reason"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="e.g. Screenshot unclear / amount mismatch"
              rows={2}
              maxLength={500}
              id="reject_reason"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {!showReject ? (
            <>
              <OutlineButton onClick={() => setShowReject(true)}>
                <span className="inline-flex items-center gap-1.5"><Ban size={14} /> Reject</span>
              </OutlineButton>
              <PrimaryButton onClick={doVerify} disabled={verify.isPending}>
                <span className="inline-flex items-center gap-1.5"><Check size={14} /> Mark Paid</span>
              </PrimaryButton>
            </>
          ) : (
            <>
              <OutlineButton onClick={() => setShowReject(false)}>Back</OutlineButton>
              <DangerButton onClick={doReject} disabled={reject.isPending}>
                Confirm Reject
              </DangerButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium capitalize text-gray-900">{value}</dd>
    </div>
  );
}
