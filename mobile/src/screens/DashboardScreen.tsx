import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { CalendarCheck, AlertTriangle, RotateCcw, CalendarClock, Building2, Home } from "lucide-react-native";
import { PageHeader, LoadingState, EmptyState, ErrorBanner, Card, Pill } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { PatientBookingCard } from "@/components/feature/PatientBookingCard";
import { loadDismissedMissedIds } from "@/lib/dismissedMissed";
import {
  useMyBookings,
  useFamilyMembers,
  money,
  formatDate,
  formatSlot,
  isBookingTerminal,
  isBookingMissed,
  bookingStatusMeta,
  SERVICE_MODE_LABELS,
  type Booking,
} from "@vagewell/shared";
import type { AppTabScreenProps } from "@/navigation/types";

// SCREEN_ID: DASHBOARD — patient "My Appointments" (AppointmentsTab).
// Staff/admin use the separate web portal (web/), not this app.
export function DashboardScreen({ navigation }: AppTabScreenProps<"AppointmentsTab">) {
  const { profile, user } = useAuth();
  const { data: bookings, isLoading, error, refetch } = useMyBookings();
  const { data: deps } = useFamilyMembers();
  const depMap = useMemo(() => Object.fromEntries((deps ?? []).map((d) => [d.id, d.full_name])), [deps]);
  const profileName = profile?.full_name ?? "Myself";
  const userId = user?.id ?? "";
  const [dismissedMissed, setDismissedMissed] = useState<Set<string>>(new Set());

  // Belt-and-braces: refetch every time this tab gains focus (booking a new
  // appointment, uploading a payment proof, or rescheduling all happen on a
  // different tab/screen) so nothing here is ever left showing stale data.
  // Dismissed-missed IDs are also reloaded on focus — the actual dismissal
  // happens in PaymentScreen once a reschedule is genuinely booked, so this
  // tab needs to pick that up whenever it's returned to, not just once.
  useFocusEffect(
    useCallback(() => {
      void refetch();
      loadDismissedMissedIds().then(setDismissedMissed);
    }, [refetch])
  );

  const nameFor = (b: Booking) => (b.family_member_id ? depMap[b.family_member_id] ?? "Dependent" : profileName);

  // Just opens the Appointment form for the same service — the missed
  // booking is NOT touched (cancelled/dismissed) yet. Tapping Reschedule
  // doesn't commit to anything; only actually completing the new booking in
  // PaymentScreen does, since the customer might back out of the form first.
  const reschedule = (b: Booking) =>
    navigation.navigate("ServicesTab", { screen: "Appointment", params: { serviceId: b.service_id, rescheduleOf: b.id } });

  // A missed booking (scheduled date already passed, never reached a terminal
  // state) leaves the plain "upcoming" list. Only the single most recent one
  // surfaces here as a nudge to reschedule — the complete history (every past
  // checkup, missed or otherwise) lives in the Profile's Health record Checkup
  // list, not this tab.
  const { active, recentMissed, lastCompleted, hasAny } = useMemo(() => {
    const all = bookings ?? [];
    const notTerminal = all.filter((b) => !isBookingTerminal(b.booking_status));
    const missedSorted = notTerminal
      .filter((b) => isBookingMissed(b.booking_status, b.start_date, b.time_slot) && !dismissedMissed.has(b.id))
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
    const completedSorted = all
      .filter((b) => b.booking_status === "completed")
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
    return {
      active: notTerminal.filter((b) => !isBookingMissed(b.booking_status, b.start_date, b.time_slot)),
      recentMissed: missedSorted[0] ?? null,
      lastCompleted: completedSorted[0] ?? null,
      hasAny: all.length > 0,
    };
  }, [bookings, dismissedMissed]);

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
          ListFooterComponent={
            lastCompleted ? <LastCompletedCheckup booking={lastCompleted} subjectName={nameFor(lastCompleted)} /> : null
          }
          renderItem={({ item: b }) => (
            <PatientBookingCard booking={b} userId={userId} subjectName={nameFor(b)} />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

/** Small "Clinic Visit" / "Home Care" indicator — only present once admin has approved and picked one. */
function ServiceModeBadge({ booking }: { booking: Booking }) {
  if (!booking.service_mode) return null;
  return (
    <View className="mt-1.5 flex-row items-center gap-1 self-start rounded-md bg-indigo-50 px-2 py-1">
      {booking.service_mode === "clinic" ? <Building2 size={12} color="#4338ca" /> : <Home size={12} color="#4338ca" />}
      <Text className="text-[11px] font-medium text-indigo-700">{SERVICE_MODE_LABELS[booking.service_mode]}</Text>
    </View>
  );
}

/**
 * Read-only summary of the most recent completed visit. Deliberately NOT a
 * PatientBookingCard — that one carries Cancel/re-upload affordances which
 * must never appear on a finished booking. The full checkup history (every
 * completed/cancelled/missed visit) lives in the Profile's Health record;
 * this is just an at-a-glance pointer to the latest one.
 */
function LastCompletedCheckup({ booking, subjectName }: { booking: Booking; subjectName: string }) {
  const status = bookingStatusMeta(booking.booking_status);
  return (
    <View className="mt-5">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Last checkup completed</Text>
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
                {formatDate(booking.start_date)} · {formatSlot(booking.time_slot)}
              </Text>
              <ServiceModeBadge booking={booking} />
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
            <ServiceModeBadge booking={booking} />
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
