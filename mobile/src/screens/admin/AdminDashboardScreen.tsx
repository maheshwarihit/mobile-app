import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { toast } from "sonner-native";
import { Lock, Users, FileSpreadsheet, Download, FileSearch, Activity, CalendarCheck, CalendarDays, QrCode } from "lucide-react-native";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { AppointmentCalendar } from "@/components/admin/AppointmentCalendar";
import { FormInput, Card, Pill, OutlineButton, LoadingState, EmptyState, ErrorBanner } from "@/components/ui";
import { BRAND } from "@/theme";
import { useAuth } from "@/providers/AuthProvider";
import { PaymentReviewModal } from "@/components/feature/PaymentReviewModal";
import { VitalsModal, type VitalsSubject } from "@/components/feature/VitalsModal";
import { exportAppointmentsToExcel } from "@/lib/export";
import {
  useAllBookings,
  money,
  formatDate,
  PAYMENT_STATUS_META,
  type BookingWithNames,
} from "@vagewell/shared";
import type { AdminScreenProps } from "@/navigation/types";

export function AdminDashboardScreen({ navigation }: AdminScreenProps<"AdminDashboard">) {
  const { signOut } = useAuth();
  const { data: bookings, isLoading, error } = useAllBookings(true);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<BookingWithNames | null>(null);
  const [vitals, setVitals] = useState<VitalsSubject | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showCal, setShowCal] = useState(false);

  const all = bookings ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((b) => {
      if (day && b.start_date !== day) return false;
      if (!q) return true;
      return (
        (b.subject_name ?? "").toLowerCase().includes(q) ||
        (b.account?.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, query, day]);

  const openVitals = (b: BookingWithNames) =>
    setVitals(
      b.family_member_id
        ? { familyMemberId: b.family_member_id, name: b.subject_name ?? "Dependent" }
        : { profileId: b.account_id, name: b.subject_name ?? b.account?.full_name ?? "Patient" }
    );

  const doExport = async () => {
    setExporting(true);
    try {
      await exportAppointmentsToExcel(all);
    } catch {
      toast.error("Could not export. Please try again.");
    }
    setExporting(false);
  };

  return (
    <AdminScreen
      title="All appointments"
      icon={Lock}
      dark
      right={
        <Pressable onPress={signOut} hitSlop={8}>
          <Text className="text-sm font-semibold text-admin-accent">Log out</Text>
        </Pressable>
      }
    >
      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        contentContainerClassName="px-5 pt-4 pb-8 gap-3"
        ListHeaderComponent={
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-1">
                <OutlineButton fullWidth icon={Users} onPress={() => navigation.navigate("AdminPatientList")}>
                  Patient profiles
                </OutlineButton>
              </View>
              <View className="flex-1">
                <OutlineButton fullWidth icon={FileSpreadsheet} onPress={() => navigation.navigate("LiveSheet")}>
                  Live sheet
                </OutlineButton>
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <OutlineButton fullWidth icon={QrCode} onPress={() => navigation.navigate("AdminPaymentQr")}>
                  Payment QR
                </OutlineButton>
              </View>
              <View className="flex-1">
                <OutlineButton fullWidth icon={Download} onPress={doExport}>
                  {exporting ? "Exporting…" : "Export"}
                </OutlineButton>
              </View>
            </View>

            <FormInput label="Search patient by name" value={query} onChangeText={setQuery} placeholder="Type a name…" />

            {/* Calendar is collapsed behind a button; tap to open and filter by date. */}
            <Pressable
              onPress={() => setShowCal((v) => !v)}
              className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5 active:opacity-80"
            >
              <View className="flex-row items-center gap-2">
                <CalendarDays size={16} color={BRAND} />
                <Text className="text-sm font-medium text-gray-700">
                  {day ? `Filtered: ${formatDate(day)}` : "Filter by date"}
                </Text>
              </View>
              <Text className="text-xs font-semibold text-purple-600">{showCal ? "Hide" : "Open"}</Text>
            </Pressable>
            {showCal ? (
              <AppointmentCalendar bookings={all} selectedDay={day} onSelectDay={setDay} />
            ) : null}

            {error ? <ErrorBanner message="Could not load appointments." /> : null}
            {isLoading ? <LoadingState message="Loading appointments…" /> : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState icon={CalendarCheck} title="No appointments" description="Bookings from all users appear here." />
          ) : null
        }
        renderItem={({ item: b }) => (
          <AdminBookingCard booking={b} onReview={() => setSelected(b)} onVitals={() => openVitals(b)} />
        )}
      />

      <PaymentReviewModal booking={selected} onClose={() => setSelected(null)} />
      <VitalsModal open={!!vitals} subject={vitals} onClose={() => setVitals(null)} />
    </AdminScreen>
  );
}

function AdminBookingCard({
  booking,
  onReview,
  onVitals,
}: {
  booking: BookingWithNames;
  onReview: () => void;
  onVitals: () => void;
}) {
  const m = PAYMENT_STATUS_META[booking.payment_status];
  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">{booking.service_name}</Text>
          <Text className="text-xs text-gray-500">
            {booking.account?.full_name ?? "—"} · for {booking.subject_name ?? "—"}
          </Text>
          <Text className="mt-1 text-sm text-gray-600">
            {formatDate(booking.start_date)} · {money(booking.total_amount)}
          </Text>
        </View>
        <Pill bgClass={m.bg} textClass={m.text}>
          {m.label}
        </Pill>
      </View>
      <View className="mt-3 flex-row gap-5 border-t border-gray-100 pt-3">
        <Pressable onPress={onReview} className="flex-row items-center gap-1 active:opacity-70">
          <FileSearch size={14} color={BRAND} />
          <Text className="text-sm font-medium text-purple-600">Review</Text>
        </Pressable>
        <Pressable onPress={onVitals} className="flex-row items-center gap-1 active:opacity-70">
          <Activity size={14} color="#4b5563" />
          <Text className="text-sm font-medium text-gray-600">Vitals</Text>
        </Pressable>
      </View>
    </Card>
  );
}
