import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { formatDate, formatSlot, type BookingWithNames } from "@vagewell/shared";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Client-side Excel export (staff/admin "Export to Excel"). Builds the .xlsx in
 * memory, writes it to the cache dir, and opens the Android share sheet.
 */
export async function exportAppointmentsToExcel(rows: BookingWithNames[]): Promise<void> {
  const data = rows.map((b) => ({
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

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Appointments");
  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  const stamp = new Date().toISOString().slice(0, 10);
  const uri = `${FileSystem.cacheDirectory}vagewell-appointments-${stamp}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: XLSX_MIME, dialogTitle: "Export appointments" });
  }
}
