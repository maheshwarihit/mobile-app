import { useMemo } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarCheck, AlertTriangle, RotateCcw } from "lucide-react-native";
import { PageHeader, LoadingState, EmptyState, ErrorBanner, Card, Pill } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { PatientBookingCard } from "@/components/feature/PatientBookingCard";
import {
  useMyBookings,
  useFamilyMembers,
  money,
  formatDate,
  formatSlot,
  isBookingTerminal,
  isBookingMissed,
  type Booking,
} from "@vagewell/shared";
import type { AppTabScreenProps } from "@/navigation/types";

// SCREEN_ID: DASHBOARD — patient "My Appointments" (AppointmentsTab).
// Staff/admin use the separate web portal (web/), not this app.
export function DashboardScreen({ navigation }: AppTabScreenProps<"AppointmentsTab">) {
  const { profile, user } = useAuth();
  const { data: bookings, isLoading, error } = useMyBookings();
  const { data: deps } = useFamilyMembers();
  const depMap = useMemo(() => Object.fromEntries((deps ?? []).map((d) => [d.id, d.full_name])), [deps]);
  const profileName = profile?.full_name ?? "Myself";
  const userId = user?.id ?? "";

  const nameFor = (b: Booking) => (b.family_member_id ? depMap[b.family_member_id] ?? "Dependent" : profileName);

  const reschedule = (b: Booking) =>
    navigation.navigate("ServicesTab", { screen: "Appointment", params: { serviceId: b.service_id } });

  // A missed booking (scheduled date already passed, never reached a terminal
  // state) leaves the plain "upcoming" list. Only the single most recent one
  // surfaces here as a nudge to reschedule — the complete history (every past
  // checkup, missed or otherwise) lives in the Profile's Health record Checkup
  // list, not this tab.
  const { active, recentMissed, hasAny } = useMemo(() => {
    const all = bookings ?? [];
    const notTerminal = all.filter((b) => !isBookingTerminal(b.booking_status));
    const missedSorted = notTerminal
      .filter((b) => isBookingMissed(b.booking_status, b.start_date))
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
    return {
      active: notTerminal.filter((b) => !isBookingMissed(b.booking_status, b.start_date)),
      recentMissed: missedSorted[0] ?? null,
      hasAny: all.length > 0,
    };
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
              {recentMissed ? (
                <View className="mb-4 gap-2">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-red-500">Recently missed</Text>
                  <MissedAppointment
                    booking={recentMissed}
                    subjectName={nameFor(recentMissed)}
                    onReschedule={() => reschedule(recentMissed)}
                  />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              // Finished, cancelled and missed visits are filtered out, so
              // "none yet" would be wrong for anyone who has ever booked.
              <EmptyState
                icon={CalendarCheck}
                title={hasAny ? "No upcoming appointments" : "No appointments yet"}
                description={hasAny ? "Book a service to schedule your next visit." : "Book a service to see it here."}
              />
            ) : null
          }
          renderItem={({ item: b }) => (
            <PatientBookingCard booking={b} userId={userId} subjectName={nameFor(b)} />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

/** A booking whose date has passed with nothing done about it — offer a reschedule. */
function MissedAppointment({
  booking,
  subjectName,
  onReschedule,
}: {
  booking: Booking;
  subjectName: string;
  onReschedule: () => void;
}) {
  return (
    <Card className="border border-red-100 bg-red-50/40 p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row items-start gap-3">
          <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-red-100">
            <AlertTriangle size={18} color="#b91c1c" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">{booking.service_name}</Text>
            <Text className="text-xs text-gray-500">
              Patient <Text className="font-medium text-purple-600">{subjectName}</Text>
            </Text>
            <Text className="mt-1 text-sm text-gray-600">
              {formatDate(booking.start_date)} · {formatSlot(booking.time_slot)}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-base font-bold text-gray-900">{money(booking.total_amount)}</Text>
          <Pill bgClass="bg-red-100" textClass="text-red-700">
            You missed it
          </Pill>
        </View>
      </View>
      <Pressable
        onPress={onReschedule}
        className="mt-3 flex-row items-center justify-center gap-1.5 self-end rounded-lg bg-red-600 px-3 py-1.5 active:bg-red-700"
      >
        <RotateCcw size={13} color="#fff" />
        <Text className="text-xs font-medium text-white">Reschedule</Text>
      </Pressable>
    </Card>
  );
}
