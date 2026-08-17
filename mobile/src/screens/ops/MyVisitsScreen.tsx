import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Activity, PlayCircle, UploadCloud, CheckCircle2, Eye, ClipboardList, Phone } from "lucide-react-native";
import {
  useMyAssignedBookings,
  useAllReports,
  useStartVisit,
  useCompleteVisit,
  money,
  formatDate,
  formatSlot,
  formatLocalDateTime,
  bookingStatusMeta,
  localPhone,
  MEDICAL_REPORT_BUCKET,
  type BookingWithNames,
  type ReportUpload,
} from "@vagewell/shared";
import { PageHeader, Card, Pill, LoadingState, EmptyState, ErrorBanner, ConfirmModal } from "@/components/ui";
import { VitalsModal, type VitalsSubject } from "@/components/ops/VitalsModal";
import { ReportUploadModal } from "@/components/ops/ReportUploadModal";
import { CardAction } from "@/screens/ops/AdminAppointmentsScreen";
import { useSignedUrl, openUrl } from "@/lib/signedUrl";

/**
 * SCREEN_ID: MY_VISITS — the caregiver's own work queue: visits an admin
 * assigned to them, and the actions to run one (start → vitals / upload report
 * → complete). Port of web/src/app/my-visits/page.tsx.
 *
 * `useMyAssignedBookings` filters to `assigned_to = auth.uid()` client-side on
 * top of RLS, so an admin opening this screen sees their own assigned work
 * rather than everything — the full cross-account list is the Appointments tab.
 */
export function MyVisitsScreen() {
  const { data: bookings, isLoading, error, refetch } = useMyAssignedBookings(true);
  const { data: reports, refetch: refetchReports } = useAllReports(true);
  const [vitals, setVitals] = useState<VitalsSubject | null>(null);
  const [reporting, setReporting] = useState<BookingWithNames | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchReports();
    }, [refetch, refetchReports])
  );

  const active = useMemo(
    () =>
      (bookings ?? []).filter((b) => b.booking_status !== "completed" && b.booking_status !== "cancelled"),
    [bookings]
  );

  const latestReportByBooking = useMemo(() => {
    const map = new Map<string, ReportUpload>();
    for (const r of reports ?? []) if (!map.has(r.booking_id)) map.set(r.booking_id, r);
    return map;
  }, [reports]);

  const openVitals = (b: BookingWithNames) =>
    setVitals(
      b.family_member_id
        ? { familyMemberId: b.family_member_id, name: b.subject_name ?? "Dependent" }
        : { profileId: b.account_id, name: b.subject_name ?? b.account?.full_name ?? "Client" }
    );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={["top"]}>
      <FlatList
        data={active}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View>
            <PageHeader title="My visits" subtitle="Home visits assigned to you." />
            {error ? <ErrorBanner message="Could not load your visits." /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message="Loading…" />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No assigned visits"
              description="Work an admin assigns to you appears here."
            />
          )
        }
        renderItem={({ item }) => (
          <VisitCard
            booking={item}
            latestReport={latestReportByBooking.get(item.id) ?? null}
            onVitals={() => openVitals(item)}
            onReport={() => setReporting(item)}
          />
        )}
      />

      <VitalsModal
        key={vitals ? `${vitals.profileId ?? ""}:${vitals.familyMemberId ?? ""}` : "none"}
        open={!!vitals}
        subject={vitals}
        onClose={() => setVitals(null)}
      />
      {reporting ? (
        <ReportUploadModal key={reporting.id} booking={reporting} onClose={() => setReporting(null)} />
      ) : null}
    </SafeAreaView>
  );
}

function VisitCard({
  booking,
  latestReport,
  onVitals,
  onReport,
}: {
  booking: BookingWithNames;
  latestReport: ReportUpload | null;
  onVitals: () => void;
  onReport: () => void;
}) {
  const status = bookingStatusMeta(booking.booking_status);
  const start = useStartVisit();
  const complete = useCompleteVisit();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canStart = booking.booking_status === "assigned";
  const inFlight = booking.booking_status === "in_progress" || booking.booking_status === "report_uploaded";
  const { data: reportUrl } = useSignedUrl(MEDICAL_REPORT_BUCKET, latestReport?.storage_path);

  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">{booking.service_name}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            Client <Text className="font-medium text-purple-700 dark:text-purple-300">{booking.subject_name ?? "—"}</Text>
            {localPhone(booking.subject_phone) ? ` · ${localPhone(booking.subject_phone)}` : ""}
          </Text>
          <Text className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {formatDate(booking.start_date)} · {formatSlot(booking.time_slot)} · {money(booking.total_amount)}
          </Text>
          {booking.symptom_brief ? (
            <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">Note: {booking.symptom_brief}</Text>
          ) : null}
          {latestReport ? (
            <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Report uploaded: {latestReport.file_name ?? "file"} · {formatLocalDateTime(latestReport.created_at)}
            </Text>
          ) : null}
        </View>
        <Pill bgClass={status.bg} textClass={status.text}>{status.label}</Pill>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-3 dark:border-slate-700">
        {canStart ? (
          <CardAction
            icon={PlayCircle}
            label="Start Visit"
            onPress={() => start.mutate(booking.id)}
            disabled={start.isPending}
          />
        ) : null}
        {inFlight ? <CardAction icon={Activity} label="Vitals" onPress={onVitals} tone="muted" /> : null}
        {/* Upload is available from `assigned` onward, not just once started —
            a caregiver shouldn't have to tap Start before a report can go up. */}
        {canStart || inFlight ? (
          <CardAction icon={UploadCloud} label="Upload Report" onPress={onReport} tone="muted" />
        ) : null}
        {reportUrl ? (
          <CardAction icon={Eye} label="View Report" onPress={() => openUrl(reportUrl)} tone="muted" />
        ) : null}
        {booking.subject_phone ? (
          <CardAction icon={Phone} label="Call" onPress={() => openUrl(`tel:${booking.subject_phone}`)} tone="muted" />
        ) : null}
        {inFlight ? (
          <CardAction
            icon={CheckCircle2}
            label="Complete"
            onPress={() => setConfirmOpen(true)}
            tone="success"
            disabled={complete.isPending}
          />
        ) : null}
      </View>

      <ConfirmModal
        open={confirmOpen}
        title="Mark visit complete?"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          complete.mutate(booking.id);
          setConfirmOpen(false);
        }}
        confirmLabel="Mark complete"
        cancelLabel="Not yet"
      >
        <Text className="text-sm text-gray-600">
          This closes the {booking.service_name} visit on {formatDate(booking.start_date)} and removes it from your
          active list.
        </Text>
      </ConfirmModal>
    </Card>
  );
}
