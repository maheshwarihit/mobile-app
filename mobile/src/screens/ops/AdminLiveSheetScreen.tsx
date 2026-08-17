import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { toast } from "sonner-native";
import { Table2, Download } from "lucide-react-native";
import {
  useAllBookings,
  useAllClinicalRecords,
  useAllReports,
  liveSheetRows,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  type LiveSheetRow,
  type ReportUpload,
} from "@vagewell/shared";
import { PageHeader, Card, FormInput, DateField, LoadingState, EmptyState, SmallPrimaryButton } from "@/components/ui";
import { rowsToCsv, downloadCsv } from "@/lib/csv";
import { useSignedUrl, openUrl } from "@/lib/signedUrl";
import { BRAND } from "@/theme";

type ColumnDef = { key: keyof LiveSheetRow; header: string; width: number };

// Every column liveSheetRows() produces, in its original order/labels.
const OVERALL_COLUMNS: ColumnDef[] = [
  { key: "Account Holder", header: "Account Holder", width: 140 },
  { key: "Account Phone", header: "Account Phone", width: 120 },
  { key: "Appointment For", header: "Appointment For", width: 140 },
  { key: "Relation", header: "Relation", width: 90 },
  { key: "Client Number", header: "Client Number", width: 120 },
  { key: "Age", header: "Age", width: 60 },
  { key: "Blood Pressure", header: "Blood Pressure", width: 110 },
  { key: "Sugar Level", header: "Sugar Level", width: 90 },
  { key: "Blood Group", header: "Blood Group", width: 90 },
  { key: "Other Conditions", header: "Other Conditions", width: 160 },
  { key: "Service", header: "Service", width: 130 },
  { key: "Days", header: "Days", width: 70 },
  { key: "Price/Day (INR)", header: "Price/Day", width: 100 },
  { key: "Total (INR)", header: "Total", width: 100 },
  { key: "Date/Time", header: "Date/Time", width: 170 },
  { key: "Payment Method", header: "Payment Method", width: 120 },
  { key: "Payment Status", header: "Payment Status", width: 110 },
  { key: "Appointment Status", header: "Appointment Status", width: 140 },
  { key: "Booking ID", header: "Booking ID", width: 100 },
  { key: "Symptom Brief", header: "Symptom Brief", width: 160 },
  { key: "Created", header: "Created", width: 160 },
];

// Condensed daily-view subset, requested column order, some relabelled.
const UPDATED_COLUMNS: ColumnDef[] = [
  { key: "Account Holder", header: "Account Holder", width: 140 },
  { key: "Appointment For", header: "Appointment For", width: 140 },
  { key: "Client Number", header: "Patient Number", width: 130 },
  { key: "Service", header: "Service", width: 130 },
  { key: "Days", header: "Days/Months", width: 100 },
  { key: "Date/Time", header: "Appointment Date", width: 170 },
  { key: "Payment Status", header: "Payment Status", width: 110 },
  { key: "Appointment Status", header: "Appointment Status", width: 140 },
];

const REPORT_COL_WIDTH = 150;

/**
 * SCREEN_ID: ADMIN_LIVE_SHEET — port of web/src/app/live-sheet/page.tsx: a
 * real horizontally-scrollable table (not condensed cards — this replaced an
 * earlier mobile-friendly card version at the user's explicit request to
 * match the original web layout), an Overall/Updated Sheet toggle, From/To
 * date-range filters, search, and a Report column listing every report ever
 * uploaded per booking (not just the latest — same as the web version's own
 * later round). Report links are deliberately excluded from the CSV export,
 * same precedent as web: a signed URL expires, so it isn't meaningful data to
 * persist in a downloaded sheet.
 */
export function AdminLiveSheetScreen() {
  const { data: bookings, isLoading, refetch } = useAllBookings(true);
  const { data: clinical, refetch: refetchClinical } = useAllClinicalRecords(true);
  const { data: reports, refetch: refetchReports } = useAllReports(true);
  const [view, setView] = useState<"overall" | "updated">("overall");
  const [query, setQuery] = useState("");
  const [dayFrom, setDayFrom] = useState("");
  const [dayTo, setDayTo] = useState("");

  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchClinical();
      void refetchReports();
    }, [refetch, refetchClinical, refetchReports])
  );

  const dateFiltered = useMemo(
    () =>
      (bookings ?? []).filter((b) => {
        if (dayFrom && b.start_date < dayFrom) return false;
        if (dayTo && b.start_date > dayTo) return false;
        return true;
      }),
    [bookings, dayFrom, dayTo]
  );

  const rows = useMemo(() => liveSheetRows(dateFiltered, clinical ?? []), [dateFiltered, clinical]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Excludes "Account Holder" deliberately — matching it pulled in unrelated
    // households whenever a different account holder's name shared a
    // substring with the patient actually being searched for (same bug
    // already fixed once on the web live sheet).
    return rows.filter((r) =>
      Object.entries(r)
        .filter(([key]) => key !== "Account Holder")
        .some(([, v]) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [rows, query]);

  const reportsByBooking = useMemo(() => {
    const map = new Map<string, ReportUpload[]>();
    for (const r of reports ?? []) {
      const list = map.get(r.booking_id) ?? [];
      list.push(r);
      map.set(r.booking_id, list);
    }
    return map;
  }, [reports]);

  const columns = view === "overall" ? OVERALL_COLUMNS : UPDATED_COLUMNS;

  const download = async () => {
    if (filtered.length === 0) {
      toast.error("Nothing to download.");
      return;
    }
    const csvRows = filtered.map((r) => Object.fromEntries(columns.map((c) => [c.header, r[c.key]])));
    await downloadCsv(`live-sheet-${view}-${Date.now()}.csv`, rowsToCsv(csvRows));
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <PageHeader
          title="Live sheet"
          subtitle="Condensed daily view — account holder, patient, service, schedule, and status."
        />

        <View className="mb-4 flex-row gap-2">
          <ViewToggleButton label="Overall Sheet" active={view === "overall"} onPress={() => setView("overall")} />
          <ViewToggleButton label="Updated Sheet" active={view === "updated"} onPress={() => setView("updated")} />
        </View>

        <View className="mb-4 gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <DateField label="From" value={dayFrom} onChange={setDayFrom} placeholder="Any date" />
            </View>
            <View className="flex-1">
              <DateField label="To" value={dayTo} onChange={setDayTo} placeholder="Any date" />
            </View>
          </View>
          <FormInput
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="Client, service, phone, symptom…"
          />
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              Showing {filtered.length} of {rows.length} rows
            </Text>
            <SmallPrimaryButton icon={Download} onPress={download}>
              Download CSV
            </SmallPrimaryButton>
          </View>
        </View>

        {isLoading ? (
          <LoadingState message="Loading…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Table2} title="No rows" description="Bookings appear here once created." />
        ) : (
          <Card className="overflow-hidden p-0">
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View className="flex-row bg-gray-50 dark:bg-slate-800">
                  {columns.map((c) => (
                    <HeaderCell key={c.key} width={c.width}>
                      {c.header}
                    </HeaderCell>
                  ))}
                  <HeaderCell width={REPORT_COL_WIDTH}>Report</HeaderCell>
                </View>
                {filtered.map((row, i) => (
                  <View
                    key={row["Booking ID"]}
                    className={`flex-row ${i % 2 ? "bg-gray-50/60 dark:bg-slate-700/30" : "bg-white dark:bg-slate-800"}`}
                  >
                    {columns.map((c) => (
                      <DataCell key={c.key} width={c.width}>
                        {String(row[c.key] ?? "") || "—"}
                      </DataCell>
                    ))}
                    <DataCell width={REPORT_COL_WIDTH}>
                      <ReportCell reports={reportsByBooking.get(row["Booking ID"]) ?? []} />
                    </DataCell>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ViewToggleButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-lg border py-2.5 active:opacity-80 ${
        active
          ? "border-purple-600 bg-purple-600"
          : "border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800"
      }`}
    >
      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-gray-600 dark:text-gray-300"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function HeaderCell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <View style={{ width }} className="justify-center px-3 py-2.5">
      <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300" numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

function DataCell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <View style={{ width }} className="justify-center border-t border-gray-100 px-3 py-2.5 dark:border-slate-700">
      {typeof children === "string" ? (
        <Text className="text-xs text-gray-700 dark:text-gray-300" numberOfLines={2}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function ReportCell({ reports }: { reports: ReportUpload[] }) {
  if (reports.length === 0) return <Text className="text-xs text-gray-300 dark:text-gray-600">—</Text>;
  return (
    <View className="gap-1">
      {reports.map((r) => (
        <ReportLink key={r.id} report={r} />
      ))}
    </View>
  );
}

function ReportLink({ report }: { report: ReportUpload }) {
  const { data: url } = useSignedUrl(MEDICAL_REPORT_BUCKET, report.storage_path);
  const label = report.file_name ?? REPORT_TYPE_LABELS[report.report_type];
  return (
    <Pressable onPress={() => url && openUrl(url)} disabled={!url} className="active:opacity-60">
      <Text className="text-xs font-medium" style={{ color: BRAND }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
