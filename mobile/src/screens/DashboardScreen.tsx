import { useMemo } from "react";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarCheck, CalendarClock } from "lucide-react-native";
import { PageHeader, LoadingState, EmptyState, ErrorBanner, Card, Pill } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { PatientBookingCard } from "@/components/feature/PatientBookingCard";
import {
  useMyBookings,
  useFamilyMembers,
  money,
  formatDate,
  formatSlot,
  BOOKING_STATUS_META,
  type Booking,
} from "@vagewell/shared";

// SCREEN_ID: DASHBOARD — patient "My Appointments" (AppointmentsTab).
// Staff/admin get the separate AdminNavigator, not this screen.
export function DashboardScreen() {
  const { profile, user } = useAuth();
  const { data: bookings, isLoading, error } = useMyBookings();
  const { data: deps } = useFamilyMembers();
  const depMap = useMemo(() => Object.fromEntries((deps ?? []).map((d) => [d.id, d.full_name])), [deps]);
  const profileName = profile?.full_name ?? "Myself";
  const userId = user?.id ?? "";

  const nameFor = (b: Booking) => (b.family_member_id ? depMap[b.family_member_id] ?? "Dependent" : profileName);

  // Completed (closed) and cancelled visits leave the list; the most recent one
  // is summarised at the bottom so the patient can still see what last happened.
  const { active, last } = useMemo(() => {
    const all = bookings ?? [];
    const finished = all
      .filter((b) => b.booking_status !== "open")
      .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.created_at.localeCompare(a.created_at));
    return { active: all.filter((b) => b.booking_status === "open"), last: finished[0] ?? null };
  }, [bookings]);

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <View className="flex-1 px-5 pt-4">
        <PageHeader title="My Appointments" subtitle="Your Bookings" />
        <FlatList
          data={active}
          keyExtractor={(b) => b.id}
          contentContainerClassName="gap-3 pb-6"
          ListHeaderComponent={
            <View>
              {error ? <ErrorBanner message="Could not load your appointments." /> : null}
              {isLoading ? <LoadingState message="Loading appointments…" /> : null}
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              // Finished visits are filtered out, so "none yet" would be wrong for
              // someone whose only bookings are already done or cancelled.
              <EmptyState
                icon={CalendarCheck}
                title={last ? "No upcoming appointments" : "No appointments yet"}
                description={last ? "Book a service to schedule your next visit." : "Book a service to see it here."}
              />
            ) : null
          }
          ListFooterComponent={last ? <LastAppointment booking={last} subjectName={nameFor(last)} /> : null}
          renderItem={({ item: b }) => (
            <PatientBookingCard booking={b} userId={userId} subjectName={nameFor(b)} />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

/**
 * Read-only summary of the most recent completed/cancelled visit. Deliberately
 * NOT a PatientBookingCard — that one carries Cancel and re-upload affordances
 * which must never appear on a finished booking.
 */
function LastAppointment({ booking, subjectName }: { booking: Booking; subjectName: string }) {
  const status = BOOKING_STATUS_META[booking.booking_status];
  return (
    <View className="mt-5">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Last appointment</Text>
      <Card className="bg-gray-50 p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 flex-row items-start gap-3">
            <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-gray-200">
              <CalendarClock size={18} color="#6b7280" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-700">{booking.service_name}</Text>
              <Text className="text-xs text-gray-500">
                Patient <Text className="font-medium text-purple-600">{subjectName}</Text>
              </Text>
              <Text className="mt-1 text-sm text-gray-600">
                {formatDate(booking.start_date)} · {formatSlot(booking.time_slot)} · {booking.num_days} day
                {booking.num_days > 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-base font-bold text-gray-700">{money(booking.total_amount)}</Text>
            <View className="mt-1">
              <Pill bgClass={status.bg} textClass={status.text}>
                {status.label}
              </Pill>
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}
