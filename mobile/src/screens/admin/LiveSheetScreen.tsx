import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { toast } from "sonner-native";
import { Download, FileSpreadsheet } from "lucide-react-native";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { OutlineButton, LoadingState, EmptyState } from "@/components/ui";
import { useAllBookings, useAllClinicalRecords } from "@vagewell/shared";
import { liveSheetRows, exportAppointmentsToCSV } from "@/lib/export";
import type { AdminScreenProps } from "@/navigation/types";

// One sheet, booking + patient + vitals. Keys must match liveSheetRows() exactly.
const COLUMNS: { key: string; width: number }[] = [
  { key: "Account Holder", width: 140 },
  { key: "Account Phone", width: 120 },
  { key: "Appointment For", width: 140 },
  { key: "Relation", width: 100 },
  { key: "Patient Number", width: 120 },
  { key: "Age", width: 55 },
  { key: "Blood Pressure", width: 110 },
  { key: "Sugar Level", width: 100 },
  { key: "Blood Group", width: 100 },
  { key: "Other Conditions", width: 200 },
  { key: "Service", width: 150 },
  { key: "Days", width: 55 },
  { key: "Price/Day (INR)", width: 110 },
  { key: "Total (INR)", width: 100 },
  { key: "Date/Time", width: 180 },
  { key: "Payment Method", width: 120 },
  { key: "Payment Status", width: 160 },
  { key: "Appointment Status", width: 140 },
  { key: "Booking ID", width: 230 },
  { key: "Symptom Brief", width: 220 },
  { key: "Created", width: 210 },
];

export function LiveSheetScreen({ navigation }: AdminScreenProps<"LiveSheet">) {
  const [exporting, setExporting] = useState(false);
  const { data: bookings, isLoading: bookingsLoading } = useAllBookings(true);
  const { data: clinical, isLoading: clinicalLoading } = useAllClinicalRecords(true);

  const isLoading = bookingsLoading || clinicalLoading;
  const rows = liveSheetRows(bookings ?? [], clinical ?? []);

  const doCsv = async () => {
    setExporting(true);
    try {
      await exportAppointmentsToCSV(bookings ?? [], clinical ?? []);
    } catch {
      toast.error("Could not export CSV.");
    }
    setExporting(false);
  };

  return (
    <AdminScreen title="Live sheet" onBack={() => navigation.goBack()}>
      <View className="flex-1 p-4">
        <Text className="mb-3 text-xs text-gray-500">
          Every appointment with the patient's details and latest vitals — the same data as the CSV export.
          Scroll sideways to see every column.
        </Text>

        {isLoading ? (
          <LoadingState message="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No appointments" description="Bookings appear here." />
        ) : (
          <View className="flex-1 rounded-lg border border-gray-200 bg-white">
            <ScrollView horizontal>
              <View>
                {/* header */}
                <View className="flex-row border-b border-gray-200 bg-gray-50">
                  {COLUMNS.map((c) => (
                    <Text
                      key={c.key}
                      style={{ width: c.width }}
                      className="px-2 py-2 text-[11px] font-bold text-gray-700"
                    >
                      {c.key}
                    </Text>
                  ))}
                </View>
                {/* rows */}
                <ScrollView>
                  {rows.map((row, i) => (
                    <View key={i} className={`flex-row ${i % 2 ? "bg-gray-50" : "bg-white"}`}>
                      {COLUMNS.map((c) => (
                        <Text
                          key={c.key}
                          style={{ width: c.width }}
                          numberOfLines={1}
                          className="border-b border-gray-100 px-2 py-2 text-[11px] text-gray-700"
                        >
                          {String((row as Record<string, unknown>)[c.key] ?? "")}
                        </Text>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        )}

        <View className="mt-3">
          <OutlineButton fullWidth icon={Download} onPress={doCsv}>
            {exporting ? "Preparing…" : "Download as CSV"}
          </OutlineButton>
        </View>
      </View>
    </AdminScreen>
  );
}
