import type { PaymentStatus, BookingStatus } from "./types";
import {
  SLOT_MINUTES,
  BOOKING_START_HOUR,
  BOOKING_END_HOUR,
} from "./constants";

export function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

// Semantic status colours. `bg`/`text` are Tailwind classes (web + NativeWind);
// mobile screens that need raw hex map these keys in the theme.
type PillColors = { label: string; bg: string; text: string };

export const PAYMENT_STATUS_META: Record<PaymentStatus, PillColors> = {
  pending: { label: "Pending", bg: "bg-gray-100", text: "text-gray-600" },
  pending_verification: { label: "Awaiting Verification", bg: "bg-amber-50", text: "text-amber-700" },
  paid: { label: "Paid", bg: "bg-emerald-50", text: "text-emerald-700" },
  pay_at_visit: { label: "Pay at Visit", bg: "bg-blue-50", text: "text-blue-700" },
};

// Assignment pipeline (platform-expansion round): requested → approved →
// assigned → in_progress → report_uploaded → completed, or cancelled at any
// point before completed.
export const BOOKING_STATUS_META: Record<BookingStatus, PillColors> = {
  requested: { label: "Requested", bg: "bg-gray-100", text: "text-gray-600" },
  approved: { label: "Approved", bg: "bg-blue-50", text: "text-blue-700" },
  assigned: { label: "Assigned", bg: "bg-indigo-50", text: "text-indigo-700" },
  in_progress: { label: "In Progress", bg: "bg-amber-50", text: "text-amber-700" },
  report_uploaded: { label: "Report Uploaded", bg: "bg-violet-50", text: "text-violet-700" },
  completed: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { label: "Cancelled", bg: "bg-red-50", text: "text-red-700" },
};

/** True once a booking has left the active pipeline (no further staff action expected). */
export function isBookingTerminal(status: BookingStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * A booking whose scheduled start (date AND time slot, not date alone) has
 * already passed without ever reaching a terminal state — the pipeline itself
 * has no "missed" status (this is a client-side read on a stale-but-still-
 * active booking, not a server state). A same-day booking isn't "missed" the
 * moment the calendar flips — it's missed once its actual time slot has gone
 * by, e.g. a 9 AM slot is missed by 6 PM the same day, not just tomorrow.
 */
export function isBookingMissed(status: BookingStatus, startDate: string, timeSlot: string): boolean {
  if (isBookingTerminal(status)) return false;
  const [y, m, d] = startDate.split("-").map(Number);
  const [hh, mm] = timeSlot.split(":").map(Number);
  if (!y || !m || !d) return false;
  const scheduled = new Date(y, m - 1, d, hh || 0, mm || 0);
  return scheduled.getTime() < Date.now();
}

// Rows can carry a status written before a schema migration ran (e.g. the old
// 'open'/'closed' values), so these two always return *something* instead of
// letting a bare object-index crash the screen on stale data.
const UNKNOWN_META = (value: string): PillColors => ({ label: value, bg: "bg-gray-100", text: "text-gray-600" });

export function paymentStatusMeta(status: string): PillColors {
  return PAYMENT_STATUS_META[status as PaymentStatus] ?? UNKNOWN_META(status);
}

export function bookingStatusMeta(status: string): PillColors {
  return BOOKING_STATUS_META[status as BookingStatus] ?? UNKNOWN_META(status);
}

/** Build selectable 15-minute time slots within business hours (GR-4). */
export function timeSlots(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let h = BOOKING_START_HOUR; h <= BOOKING_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      if (h === BOOKING_END_HOUR && m > 0) break; // last start = END_HOUR:00
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const suffix = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const label = `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
      out.push({ value, label });
    }
  }
  return out;
}
