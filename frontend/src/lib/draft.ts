// Booking draft passed from APPOINTMENT → PAYMENT (payment_method is chosen on
// the payment screen, and the booking row is only inserted there).
export interface BookingDraft {
  service_id: string;
  service_name: string;
  price_per_day: number;
  family_member_id: string | null;
  subject_name: string;
  start_date: string;
  num_days: number;
  time_slot: string;
  symptom_brief: string;
}

const KEY = "vw_booking_draft";

export function saveDraft(d: BookingDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(d));
}

export function readDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BookingDraft) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  sessionStorage.removeItem(KEY);
}
