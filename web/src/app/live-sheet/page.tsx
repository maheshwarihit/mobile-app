"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { FormInput, OutlineButton, LoadingState, EmptyState, PageHeader } from "@/components/ui";
import { useAllBookings, useAllClinicalRecords } from "@vagewell/shared";
import { liveSheetRows, exportRowsToCSV } from "@/lib/export";

const COLUMNS = [
  "Account Holder",
  "Account Phone",
  "Appointment For",
  "Relation",
  "Patient Number",
  "Age",
  "Blood Pressure",
  "Sugar Level",
  "Blood Group",
  "Other Conditions",
  "Service",
  "Days",
  "Price/Day (INR)",
  "Total (INR)",
  "Date/Time",
  "Payment Method",
  "Payment Status",
  "Appointment Status",
  "Booking ID",
  "Symptom Brief",
  "Created",
] as const;

function LiveSheetContent() {
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const { data: bookings, isLoading: bookingsLoading } = useAllBookings(true);
  const { data: clinical, isLoading: clinicalLoading } = useAllClinicalRecords(true);

  const isLoading = bookingsLoading || clinicalLoading;
  const rows = useMemo(() => liveSheetRows(bookings ?? [], clinical ?? []), [bookings, clinical]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row)
        .map((v) => String(v ?? ""))
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const doCsv = async () => {
    setExporting(true);
    try {
      await exportRowsToCSV(visible);
    } catch {
      toast.error("Could not export CSV.");
    }
    setExporting(false);
  };

  return (
    <div>
      <PageHeader title="Live sheet" />
      <p className="mb-3 text-xs text-gray-500">
        Every appointment with the patient&apos;s details and latest vitals. Search matches any column, and the CSV
        downloads exactly what&apos;s listed. Scroll sideways to see every column.
      </p>

      <div className="mb-1.5">
        <FormInput
          value={query}
          onChangeText={setQuery}
          icon={Search}
          placeholder="Search anything — name, phone, service, status…"
        />
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Showing {visible.length} of {rows.length} row{rows.length === 1 ? "" : "s"}
      </p>

      {isLoading ? (
        <LoadingState message="Loading…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="No appointments" description="Bookings appear here." />
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title="No matches" description={`Nothing matches "${query.trim()}".`} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full border-collapse text-left text-[11px] text-gray-700">
            <thead className="bg-gray-50">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c} className="whitespace-nowrap border-b border-gray-200 px-2 py-2 font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr key={i} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                  {COLUMNS.map((c) => (
                    <td key={c} className="max-w-[220px] truncate whitespace-nowrap border-b border-gray-100 px-2 py-2">
                      {String((row as Record<string, unknown>)[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3">
        <OutlineButton fullWidth icon={Download} disabled={visible.length === 0} loading={exporting} onClick={doCsv}>
          {query.trim() ? `Download ${visible.length} row${visible.length === 1 ? "" : "s"} as CSV` : "Download as CSV"}
        </OutlineButton>
      </div>
    </div>
  );
}

export default function LiveSheetPage() {
  return (
    <RequireStaff>
      <LiveSheetContent />
    </RequireStaff>
  );
}
