import * as XLSX from "xlsx";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  formatDate,
  formatSlot,
  PAYMENT_STATUS_META,
  BOOKING_STATUS_META,
  type BookingWithNames,
  type ClinicalRecord,
} from "@vagewell/shared";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIME = "text/csv";

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
 * CSV download and the Excel export. One sheet carries the booking, the patient
 * and their vitals (there is no separate medical-records sheet).
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

/**
 * Write rows to a spreadsheet and hand it to the user.
 * - Web/PWA: build a Blob and trigger a browser download (expo-file-system and
 *   expo-sharing are native-only and no-op on web, which is why the old
 *   native-only path "did nothing" in the browser). DOM globals are reached via
 *   globalThis so this compiles without the DOM lib in tsconfig.
 * - Native: base64 → cache file → OS share sheet.
 */
async function downloadSheet(
  records: Record<string, unknown>[],
  bookType: "xlsx" | "csv",
  sheetName: string,
  fileBase: string
): Promise<void> {
  const ws = XLSX.utils.json_to_sheet(records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${fileBase}-${stamp}.${bookType}`;
  const mime = bookType === "xlsx" ? XLSX_MIME : CSV_MIME;

  if (Platform.OS === "web") {
    const g = globalThis as any;
    const bytes = XLSX.write(wb, { type: "array", bookType });
    const blob = new g.Blob([bytes], { type: mime });
    const url = g.URL.createObjectURL(blob);
    const a = g.document.createElement("a");
    a.href = url;
    a.download = filename;
    g.document.body.appendChild(a);
    a.click();
    a.remove();
    g.setTimeout(() => g.URL.revokeObjectURL(url), 1500);
    return;
  }

  const base64 = XLSX.write(wb, { type: "base64", bookType });
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: sheetName });
  }
}

/** Client-side Excel export (staff/admin "Export"). */
export async function exportAppointmentsToExcel(
  rows: BookingWithNames[],
  clinical: ClinicalRecord[]
): Promise<void> {
  await downloadSheet(liveSheetRows(rows, clinical), "xlsx", "Appointments", "vagewell-appointments");
}

/**
 * Client-side CSV export (admin live sheet "Download as CSV"). Takes rows the
 * caller has already built with liveSheetRows(), so the download matches what the
 * screen is showing — including the live sheet's search filter.
 */
export async function exportRowsToCSV(rows: Record<string, unknown>[]): Promise<void> {
  await downloadSheet(rows, "csv", "Appointments", "vagewell-appointments");
}
