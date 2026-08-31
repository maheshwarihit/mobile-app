import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { CalendarCheck, AlertTriangle, RotateCcw, CalendarClock, X } from "lucide-react-native";
import { PageHeader, LoadingState, EmptyState, ErrorBanner, Card, Pill } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { PatientBookingCard } from "@/components/feature/PatientBookingCard";
import { loadDismissedMissedIds, dismissMissedBooking } from "@/lib/dismissedMissed";
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";
import {
  useMyBookings,
  useFamilyMembers,
  useCancelBooking,
  formatDate,
  formatSlot,
  isBookingTerminal,
  isBookingMissed,
  bookingStatusMeta,
  money,
  type Booking,
} from "@vagewell/shared";
import type { AppTabScreenProps } from "@/navigation/types";

// SCREEN_ID: DASHBOARD — patient "My Appointments" (AppointmentsTab).
// Staff/admin use the separate web portal (web/), not this app.
export function DashboardScreen({ navigation }: AppTabScreenProps<"AppointmentsTab">) {
  const { t } = useLanguage();
  const { profile, user } = useAuth();
  const { data: bookings, isLoading, error, refetch } = useMyBookings();
  const { data: deps } = useFamilyMembers();
  const depMap = useMemo(() => Object.fromEntries((deps ?? []).map((d) => [d.id, d.full_name])), [deps]);
  const profileName = profile?.full_name ?? "Myself";
  const userId = user?.id ?? "";
  const [dismissedMissed, setDismissedMissed] = useState<Set<string>>(new Set());

  // Belt-and-braces: refetch every time this tab gains focus (booking a new
  // appointment or uploading a payment proof happens on a different screen)
  // so nothing here is ever left showing stale data. Dismissed-missed IDs are
  // also reloaded on focus, in case they changed on another mounted instance.
  useFocusEffect(
    useCallback(() => {
      void refetch();
      loadDismissedMissedIds().then(setDismissedMissed);
    }, [refetch])
  );

  const nameFor = (b: Booking) => (b.family_member_id ? depMap[b.family_member_id] ?? t("dashboard.dependent") : profileName);

  const cancel = useCancelBooking();

  // Shared by both the "Recently missed" nudge and the Reschedule action on an
  // upcoming (not yet missed) booking — e.g. the patient already knows they
  // won't be available and wants to move it before the day even arrives,
  // rather than waiting for it to lapse into "missed" first. Two things
  // happen at once: (1) actually cancels the booking server-side when the
  // patient is allowed to (requested/approved — server-enforced), which
  // permanently removes it from every future "missed" computation regardless
  // of device, reload, or reinstall; (2) also dismisses it locally as a
  // belt-and-braces for the case where the server cancel isn't permitted
  // (already assigned/in_progress) — that one is left for staff to close out
  // from the web portal, but shouldn't keep nagging this device either. Step
  // (2) is a no-op for an upcoming booking (it was never in the dismissed-
  // missed set to begin with) — harmless to still run unconditionally.
  const reschedule = (b: Booking) => {
    if (b.booking_status === "requested" || b.booking_status === "approved") {
      cancel.mutate(b.id);
    }
    setDismissedMissed((prev) => new Set(prev).add(b.id));
    void dismissMissedBooking(b.id);
    navigation.navigate("ServicesTab", { screen: "Appointment", params: { serviceId: b.service_id } });
  };

  // The "X" — for when the customer doesn't want to reschedule at all, just
  // stop being nagged about it. Local dismiss only: the booking itself is
  // left exactly as it is (staff still see and can act on the real row).
  const dismissOnly = (b: Booking) => {
    setDismissedMissed((prev) => new Set(prev).add(b.id));
    void dismissMissedBooking(b.id);
  };

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
    // Soonest appointment first — the underlying query orders by created_at
    // (newest booking first), which is the right order for "recently missed"/
    // "last completed" above but not for what's still upcoming: a booking
    // made later that happens to be scheduled sooner should still show first.
    const activeSorted = notTerminal
      .filter((b) => !isBookingMissed(b.booking_status, b.start_date, b.time_slot))
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.time_slot.localeCompare(b.time_slot));
    return {
      active: activeSorted,
      recentMissed: missedSorted[0] ?? null,
      lastCompleted: completedSorted[0] ?? null,
      hasAny: all.length > 0,
    };
  }, [bookings, dismissedMissed]);

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <View className="flex-1 px-5 pt-4">
        <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />
        <FlatList
          data={active}
          keyExtractor={(b) => b.id}
          contentContainerClassName="gap-3 pb-6"
          ListHeaderComponent={
            <View>
              {error ? <ErrorBanner message={t("dashboard.loadError")} /> : null}
              {isLoading ? <LoadingState message={t("dashboard.loading")} /> : null}
              {recentMissed ? (
                <View className="mb-4 gap-2">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-red-500">
                    {t("dashboard.recentlyMissed")}
                  </Text>
                  <MissedAppointment
                    booking={recentMissed}
                    subjectName={nameFor(recentMissed)}
                    onReschedule={() => reschedule(recentMissed)}
                    onDismiss={() => dismissOnly(recentMissed)}
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
                title={hasAny ? t("dashboard.empty.upcoming.title") : t("dashboard.empty.none.title")}
                description={hasAny ? t("dashboard.empty.upcoming.description") : t("dashboard.empty.none.description")}
              />
            ) : null
          }
          ListFooterComponent={
            lastCompleted ? <LastCompletedCheckup booking={lastCompleted} subjectName={nameFor(lastCompleted)} /> : null
          }
          renderItem={({ item: b }) => (
            <PatientBookingCard
              booking={b}
              userId={userId}
              subjectName={nameFor(b)}
              onReschedule={() => reschedule(b)}
            />
          )}
        />
      </View>
    </SafeAreaView>
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
  const { t } = useLanguage();
  const status = bookingStatusMeta(booking.booking_status);
  return (
    <View className="mt-5">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {t("dashboard.lastCheckupCompleted")}
      </Text>
      <Card className="bg-gray-50 p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 flex-row items-start gap-3">
            <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-gray-200">
              <CalendarClock size={18} color="#6b7280" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-700">{translateServiceName(t, booking.service_name)}</Text>
              <Text className="text-xs text-gray-500">
                {t("dashboard.client")} <Text className="font-medium text-purple-600">{subjectName}</Text>
              </Text>
              <Text className="mt-1 text-sm text-gray-600">
                {formatDate(booking.start_date)} · {formatSlot(booking.time_slot)}
              </Text>
              {booking.total_amount != null ? (
                <Text className="mt-1 text-sm font-semibold text-gray-900">
                  {t("bookingCard.amount", { amount: money(booking.total_amount) })}
                </Text>
              ) : null}
            </View>
          </View>
          <View className="items-end">
            <Pill bgClass={status.bg} textClass={status.text}>
              {status.label}
            </Pill>
          </View>
        </View>
      </Card>
    </View>
  );
}

/** A booking whose date has passed with nothing done about it — offer a reschedule, or dismiss it. */
function MissedAppointment({
  booking,
  subjectName,
  onReschedule,
  onDismiss,
}: {
  booking: Booking;
  subjectName: string;
  onReschedule: () => void;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Card className="border border-red-100 bg-red-50/40 p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row items-start gap-3">
          <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-red-100">
            <AlertTriangle size={18} color="#b91c1c" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">{translateServiceName(t, booking.service_name)}</Text>
            <Text className="text-xs text-gray-500">
              {t("dashboard.client")} <Text className="font-medium text-purple-600">{subjectName}</Text>
            </Text>
            <Text className="mt-1 text-sm text-gray-600">
              {formatDate(booking.start_date)} · {formatSlot(booking.time_slot)}
            </Text>
            {booking.total_amount != null ? (
              <Text className="mt-1 text-sm font-semibold text-gray-900">
                {t("bookingCard.amount", { amount: money(booking.total_amount) })}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="items-end gap-1">
          <Pressable onPress={onDismiss} hitSlop={8} className="p-1 active:opacity-60">
            <X size={16} color="#9ca3af" />
          </Pressable>
          <Pill bgClass="bg-red-100" textClass="text-red-700">
            {t("dashboard.youMissedIt")}
          </Pill>
        </View>
      </View>
      <Pressable
        onPress={onReschedule}
        className="mt-3 flex-row items-center justify-center gap-1.5 self-end rounded-lg bg-red-600 px-3 py-1.5 active:bg-red-700"
      >
        <RotateCcw size={13} color="#fff" />
        <Text className="text-xs font-medium text-white">{t("dashboard.reschedule")}</Text>
      </Pressable>
    </Card>
  );
}
