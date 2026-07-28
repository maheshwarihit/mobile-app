import * as XLSX from "xlsx";
import { liveSheetRows, type BookingWithNames, type ClinicalRecord } from "@vagewell/shared";

export { liveSheetRows };

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIME = "text/csv";

/** Build a spreadsheet in-browser and trigger a download via a Blob + anchor. */
function downloadSheet(records: Record<string, unknown>[], bookType: "xlsx" | "csv", sheetName: string, fileBase: string): void {
  const ws = XLSX.utils.json_to_sheet(records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${fileBase}-${stamp}.${bookType}`;
  const mime = bookType === "xlsx" ? XLSX_MIME : CSV_MIME;

  const bytes = XLSX.write(wb, { type: "array", bookType });
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Excel export (staff/admin dashboard "Export"). */
export async function exportAppointmentsToExcel(rows: BookingWithNames[], clinical: ClinicalRecord[]): Promise<void> {
  downloadSheet(liveSheetRows(rows, clinical), "xlsx", "Appointments", "vagewell-appointments");
}

/** CSV export (live sheet "Download as CSV") — takes rows the caller already built, so it matches the on-screen filter. */
export async function exportRowsToCSV(rows: Record<string, unknown>[]): Promise<void> {
  downloadSheet(rows, "csv", "Appointments", "vagewell-appointments");
}
