"use client";

import { useRef, useState } from "react";
import { CalendarClock, Upload, AlertTriangle } from "lucide-react";
import { Pill, DangerButton, ConfirmModal } from "@/components/ui";
import { useCancelBooking, useReuploadProof } from "@/lib/mutations";
import { money, PAYMENT_STATUS_META, BOOKING_STATUS_META } from "@/lib/format";
import { formatDate, formatSlot } from "@/lib/dates";
import type { Booking } from "@shared/types";

export function PatientBookingCard({
  booking,
  subjectName,
  userId,
}: {
  booking: Booking;
  subjectName: string;
  userId: string;
}) {
  const cancel = useCancelBooking();
  const reupload = useReuploadProof();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const pay = PAYMENT_STATUS_META[booking.payment_status];
  const status = BOOKING_STATUS_META[booking.booking_status];
  const wasRejected =
    booking.payment_status === "pending" &&
    booking.payment_method === "online" &&
    !!booking.payment_note;

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) reupload.mutate({ bookingId: booking.id, userId, file: f });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50">
            <CalendarClock size={18} className="text-purple-600" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{booking.service_name}</h3>
            <p className="text-xs text-gray-500">For {subjectName}</p>
            <p className="mt-1 text-sm text-gray-600">
              {formatDate(booking.start_date)} · {formatSlot(booking.time_slot)} · {booking.num_days} day
              {booking.num_days > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-gray-900">{money(booking.total_amount)}</p>
          <div className="mt-1 flex flex-col items-end gap-1">
            <Pill bgClass={pay.bg} textClass={pay.text}>{pay.label}</Pill>
            <Pill bgClass={status.bg} textClass={status.text}>{status.label}</Pill>
          </div>
        </div>
      </div>

      {wasRejected && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <AlertTriangle size={14} /> Payment proof was rejected
          </p>
          {booking.payment_note && <p className="mt-1 text-xs text-amber-700">{booking.payment_note}</p>}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={reupload.isPending}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            <Upload size={13} /> {reupload.isPending ? "Uploading…" : "Re-upload proof"}
          </button>
          <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={onPick} />
        </div>
      )}

      {booking.booking_status === "open" && (
        <div className="mt-3 flex justify-end">
          <DangerButton onClick={() => setConfirmOpen(true)}>Cancel</DangerButton>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Cancel appointment?"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          cancel.mutate(booking.id);
          setConfirmOpen(false);
        }}
        confirmLabel="Yes, cancel"
        cancelLabel="Keep it"
        confirmDanger
      >
        <p className="text-sm text-gray-600">
          This will cancel your {booking.service_name} appointment on {formatDate(booking.start_date)}.
        </p>
      </ConfirmModal>
    </div>
  );
}
