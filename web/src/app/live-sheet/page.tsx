"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Search, CalendarDays, Eye } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { FormInput, OutlineButton, LoadingState, EmptyState, PageHeader } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  useAllBookings,
  useAllClinicalRecords,
  useAllReports,
  MEDICAL_REPORT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  REPORT_TYPE_LABELS,
  type LiveSheetRow,
  type ReportUpload,
} from "@vagewell/shared";
import { liveSheetRows, exportRowsToCSV } from "@/lib/export";

const OVERALL_COLUMNS = [
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

// Condensed view — the exact column set/order requested for day-to-day
// front-desk use, distinct from the full "Overall Sheet" export above.
const UPDATED_COLUMNS = [
  "Account Holder",
  "Appointment For",
  "Patient Number",
  "Service",
  "Days/Months",
  "Appointment Date",
  "Payment Status",
  "Appointment Status",
] as const;

function toUpdatedRow(row: LiveSheetRow): Record<(typeof UPDATED_COLUMNS)[number], unknown> {
  return {
    "Account Holder": row["Account Holder"],
    "Appointment For": row["Appointment For"],
    "Patient Number": row["Patient Number"],
    Service: row.Service,
    "Days/Months": row.Days,
    "Appointment Date": row["Date/Time"],
    "Payment Status": row["Payment Status"],
    "Appointment Status": row["Appointment Status"],
  };
}

function LiveSheetContent() {
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const [dayFrom, setDayFrom] = useState("");
  const [dayTo, setDayTo] = useState("");
  const [sheet, setSheet] = useState<"overall" | "updated">("overall");
  const { data: bookings, isLoading: bookingsLoading } = useAllBookings(true);
  const { data: clinical, isLoading: clinicalLoading } = useAllClinicalRecords(true);
  const { data: reports } = useAllReports(true);

  const isLoading = bookingsLoading || clinicalLoading;
  const rangedBookings = useMemo(
    () =>
      (bookings ?? []).filter((b) => {
        if (dayFrom && b.start_date < dayFrom) return false;
        if (dayTo && b.start_date > dayTo) return false;
        return true;
      }),
    [bookings, dayFrom, dayTo]
  );
  const rows = useMemo(() => liveSheetRows(rangedBookings, clinical ?? []), [rangedBookings, clinical]);

  const visibleFull = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // "Account Holder" excluded deliberately — same fix as the dashboard
    // search: matching it too meant searching a patient's name could also
    // pull in an unrelated household whose *account holder* happened to
    // share that name substring (e.g. "Maheshwari" matching an unrelated
    // "Maheshwari S" account holder's rows). "Appointment For" (the actual
    // patient), service, phone, Booking ID, etc. still match.
    return rows.filter((row) =>
      Object.entries(row)
        .filter(([key]) => key !== "Account Holder")
        .map(([, v]) => String(v ?? ""))
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const columns = sheet === "overall" ? OVERALL_COLUMNS : UPDATED_COLUMNS;
  const visible = useMemo(
    () => (sheet === "overall" ? visibleFull : visibleFull.map(toUpdatedRow)),
    [sheet, visibleFull]
  );

  // Every report for each booking (a visit can have more than one — e.g. a
  // prescription and a separate image), not just the newest — a visual-only
  // "Report" column, deliberately kept out of `columns`/`visible` so it
  // never lands in the CSV export (a signed URL expires; it isn't useful
  // data to keep). useAllReports is already created_at desc, so each
  // booking's list is newest-first too.
  const reportsByBooking = useMemo(() => {
    const map = new Map<string, ReportUpload[]>();
    for (const r of reports ?? []) {
      const list = map.get(r.booking_id) ?? [];
      list.push(r);
      map.set(r.booking_id, list);
    }
    return map;
  }, [reports]);
  const reportPaths = useMemo(() => (reports ?? []).map((r) => r.storage_path), [reports]);
  const { data: reportUrls = {} } = useQuery({
    queryKey: ["live-sheet-report-urls", reportPaths],
    enabled: reportPaths.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.storage.from(MEDICAL_REPORT_BUCKET).createSignedUrls(reportPaths, SIGNED_URL_TTL_SECONDS);
      const map: Record<string, string> = {};
      for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      return map;
    },
  });
  const reportsForRow = (fullRow: LiveSheetRow) => {
    const bookingId = String(fullRow["Booking ID"] ?? "");
    return reportsByBooking.get(bookingId) ?? [];
  };

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
        {sheet === "overall"
          ? "Every appointment with the patient's details and latest vitals. Search matches any column, and the CSV downloads exactly what's listed. Scroll sideways to see every column."
          : "Condensed daily view — account holder, patient, service, schedule, and status."}
      </p>

      <div className="mb-3 flex gap-1.5">
        <button
          onClick={() => setSheet("overall")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            sheet === "overall" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Overall Sheet
        </button>
        <button
          onClick={() => setSheet("updated")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            sheet === "updated" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Updated Sheet
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-40">
          <FormInput label="From" value={dayFrom} onChangeText={setDayFrom} type="date" icon={CalendarDays} />
        </div>
        <div className="sm:w-40">
          <FormInput label="To" value={dayTo} onChangeText={setDayTo} type="date" icon={CalendarDays} />
        </div>
      </div>

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
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap border-b border-gray-200 px-2 py-2 font-bold">
                    {c}
                  </th>
                ))}
                <th className="whitespace-nowrap border-b border-gray-200 px-2 py-2 font-bold">Report</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => {
                const rowReports = reportsForRow(visibleFull[i]);
                return (
                  <tr key={i} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                    {columns.map((c) => (
                      <td key={c} className="max-w-[220px] truncate whitespace-nowrap border-b border-gray-100 px-2 py-2">
                        {String((row as Record<string, unknown>)[c] ?? "")}
                      </td>
                    ))}
                    <td className="border-b border-gray-100 px-2 py-2">
                      {rowReports.length === 0 ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {rowReports.map((r) => {
                            const url = reportUrls[r.storage_path];
                            const label = r.file_name ?? REPORT_TYPE_LABELS[r.report_type];
                            return url ? (
                              <a
                                key={r.id}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 whitespace-nowrap font-medium text-brand-600"
                                title={label}
                              >
                                <Eye size={12} className="shrink-0" />
                                <span className="max-w-[140px] truncate">{label}</span>
                              </a>
                            ) : null;
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
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
