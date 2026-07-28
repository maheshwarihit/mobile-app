import type { BookingWithNames, ClinicalRecord } from "./types";
import { PAYMENT_STATUS_META, BOOKING_STATUS_META } from "./format";
import { formatDate, formatSlot } from "./dates";

/** The vitals a booking row carries inline, coalesced across a subject's records. */
type Vitals = {
  systolic: number | null;
  diastolic: number | null;
  blood_glucose: number | null;
  blood_group: string | null;
  medical_conditions: string | null;
};

const EMPTY_VITALS: Vitals = {
  systolic: null,
  diastolic: null,
  blood_glucose: null,
  blood_group: null,
  medical_conditions: null,
};

/** Map key for a clinical subject — account holder (`p:`) or dependent (`f:`). */
function subjectKey(profileId: string | null, familyMemberId: string | null): string | null {
  if (familyMemberId) return `f:${familyMemberId}`;
  if (profileId) return `p:${profileId}`;
  return null;
}

/**
 * Fold the vitals ledger into one row per subject.
 *
 * Staff save each visit as a NEW dated clinical_records row containing only the
 * fields they filled in, so the newest row alone would blank out a blood group
 * captured on an earlier visit. Take the most recent NON-NULL value per field
 * instead. `records` arrives ordered recorded_at desc, so the first non-null
 * value seen for a field is the most recent one.
 */
function latestVitalsBySubject(records: ClinicalRecord[]): Map<string, Vitals> {
  const out = new Map<string, Vitals>();
  for (const r of records) {
    const key = subjectKey(r.profile_id, r.family_member_id);
    if (!key) continue;
    const v = out.get(key) ?? { ...EMPTY_VITALS };
    if (v.systolic == null && r.systolic != null) v.systolic = r.systolic;
    if (v.diastolic == null && r.diastolic != null) v.diastolic = r.diastolic;
    if (v.blood_glucose == null && r.blood_glucose != null) v.blood_glucose = r.blood_glucose;
    if (v.blood_group == null && r.blood_group) v.blood_group = r.blood_group;
    if (v.medical_conditions == null && r.medical_conditions) v.medical_conditions = r.medical_conditions;
    out.set(key, v);
  }
  return out;
}

/**
 * Canonical appointment rows — the single source for the admin live sheet, the
 * CSV download and the Excel export on both the web and mobile shells. One sheet
 * carries the booking, the patient and their vitals (there is no separate
 * medical-records sheet).
 */
export function liveSheetRows(bookings: BookingWithNames[], clinical: ClinicalRecord[]) {
  const vitals = latestVitalsBySubject(clinical);
  return bookings.map((b) => {
    const key = subjectKey(b.family_member_id ? null : b.account_id, b.family_member_id);
    const v = (key && vitals.get(key)) || EMPTY_VITALS;
    const relationship = b.subject_relationship ?? "self";
    return {
      "Account Holder": b.account?.full_name ?? "",
      "Account Phone": b.account?.phone ?? "",
      "Appointment For": b.subject_name ?? "",
      Relation: relationship === "self" ? "Self" : relationship[0].toUpperCase() + relationship.slice(1),
      "Patient Number": b.subject_phone ?? "",
      Age: b.subject_age ?? "",
      "Blood Pressure": v.systolic != null && v.diastolic != null ? `${v.systolic}/${v.diastolic}` : "",
      "Sugar Level": v.blood_glucose ?? "",
      "Blood Group": v.blood_group ?? "",
      "Other Conditions": v.medical_conditions ?? "",
      Service: b.service_name,
      Days: b.num_days,
      "Price/Day (INR)": b.price_per_day,
      "Total (INR)": b.total_amount,
      "Date/Time": `${formatDate(b.start_date)} · ${formatSlot(b.time_slot)}`,
      "Payment Method": b.payment_method,
      "Payment Status": PAYMENT_STATUS_META[b.payment_status].label,
      "Appointment Status": BOOKING_STATUS_META[b.booking_status].label,
      "Booking ID": b.id,
      "Symptom Brief": b.symptom_brief ?? "",
      Created: b.created_at,
    };
  });
}

export type LiveSheetRow = ReturnType<typeof liveSheetRows>[number];
