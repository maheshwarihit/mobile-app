import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { formatDate, formatSlot, type BookingWithNames } from "@vagewell/shared";

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

async function shareWorkbook(rows: BookingWithNames[], bookType: "xlsx" | "csv"): Promise<void> {
  const ws = XLSX.utils.json_to_sheet(appointmentRows(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Appointments");
  const base64 = XLSX.write(wb, { type: "base64", bookType });

  const stamp = new Date().toISOString().slice(0, 10);
  const uri = `${FileSystem.cacheDirectory}vagewell-appointments-${stamp}.${bookType}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: bookType === "xlsx" ? XLSX_MIME : CSV_MIME,
      dialogTitle: "Export appointments",
    });
  }
}

/** Client-side Excel export (staff/admin "Export to Excel"). */
export async function exportAppointmentsToExcel(rows: BookingWithNames[]): Promise<void> {
  await shareWorkbook(rows, "xlsx");
}

/** Client-side CSV export (admin live sheet "download CSV instead"). */
export async function exportAppointmentsToCSV(rows: BookingWithNames[]): Promise<void> {
  await shareWorkbook(rows, "csv");
}
