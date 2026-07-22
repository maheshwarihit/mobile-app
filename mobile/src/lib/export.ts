import * as XLSX from "xlsx";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  formatDate,
  formatSlot,
  formatLocalDateTime,
  type BookingWithNames,
  type ClinicalRecordWithNames,
} from "@vagewell/shared";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIME = "text/csv";

/** Canonical appointment export rows (single source for Excel + CSV + live sheet). */
export function appointmentRows(rows: BookingWithNames[]) {
  return rows.map((b) => ({
    "Booking ID": b.id,
    "Account Holder": b.account?.full_name ?? "",
    Phone: b.account?.phone ?? "",
    "Care For": b.subject_name ?? "",
    Service: b.service_name,
    "Start Date": formatDate(b.start_date),
    Time: formatSlot(b.time_slot),
    Days: b.num_days,
    "Price/Day (INR)": b.price_per_day,
    "Total (INR)": b.total_amount,
    "Payment Method": b.payment_method,
    "Payment Status": b.payment_status,
    "Booking Status": b.booking_status,
    "Symptom Brief": b.symptom_brief ?? "",
    Created: b.created_at,
  }));
}

/** Canonical medical-record export rows (admin live sheet + CSV). */
export function clinicalRows(rows: ClinicalRecordWithNames[]) {
  return rows.map((r) => ({
    Patient: r.subject_name ?? "",
    "Recorded By": r.recorded_by_name ?? "",
    BP: r.systolic && r.diastolic ? `${r.systolic}/${r.diastolic}` : "",
    "Glucose (mg/dL)": r.blood_glucose ?? "",
    "SpO2 (%)": r.spo2 ?? "",
    "Blood Group": r.blood_group ?? "",
    Conditions: r.medical_conditions ?? "",
    Note: r.note ?? "",
    "Recorded At": formatLocalDateTime(r.recorded_at),
  }));
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
export async function exportAppointmentsToExcel(rows: BookingWithNames[]): Promise<void> {
  await downloadSheet(appointmentRows(rows), "xlsx", "Appointments", "vagewell-appointments");
}

/** Client-side CSV export (admin live sheet "Download as CSV"). */
export async function exportAppointmentsToCSV(rows: BookingWithNames[]): Promise<void> {
  await downloadSheet(appointmentRows(rows), "csv", "Appointments", "vagewell-appointments");
}

/** Client-side CSV export of medical records (admin live sheet). */
export async function exportClinicalToCSV(rows: ClinicalRecordWithNames[]): Promise<void> {
  await downloadSheet(clinicalRows(rows), "csv", "Medical Records", "vagewell-medical-records");
}
