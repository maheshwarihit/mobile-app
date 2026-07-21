import * as XLSX from "xlsx";
import type { BookingWithNames } from "@shared/types";
import { formatDate, formatSlot } from "@/lib/dates";

/**
 * Client-side Excel export of appointments (admin dashboard "Export to excel").
 * Admin reads all bookings via RLS, then this builds the .xlsx in the browser —
 * no server involved.
 */
export function exportAppointmentsToExcel(rows: BookingWithNames[]) {
  const data = rows.map((b) => ({
    "Booking ID": b.id,
    "Account Holder": b.account?.full_name ?? "",
    Phone: b.account?.phone ?? "",
    "Care For": b.subject_name ?? "",
    Service: b.service_name,
    "Start Date": formatDate(b.start_date),
    Time: formatSlot(b.time_slot),
    Days: b.num_days,
    "Price/Day (₹)": b.price_per_day,
    "Total (₹)": b.total_amount,
    "Payment Method": b.payment_method,
    "Payment Status": b.payment_status,
    "Booking Status": b.booking_status,
    "Symptom Brief": b.symptom_brief ?? "",
    Created: b.created_at,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Appointments");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `vagewell-appointments-${stamp}.xlsx`);
}
