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

export const BOOKING_STATUS_META: Record<BookingStatus, PillColors> = {
  open: { label: "Open", bg: "bg-blue-50", text: "text-blue-700" },
  // 'closed' is the DB value; the admin action that sets it is "Mark complete",
  // so the user-facing label reads "Completed".
  closed: { label: "Completed", bg: "bg-gray-100", text: "text-gray-500" },
  cancelled: { label: "Cancelled", bg: "bg-red-50", text: "text-red-700" },
};

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
