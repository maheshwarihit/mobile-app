import { useCallback, useRef, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { toast } from "sonner-native";
import { Activity, PlayCircle, UploadCloud, Camera, CheckCircle2, ClipboardList, Phone } from "lucide-react-native";
import {
  useMyAssignedBookings,
  useReportsForBooking,
  useVisitPhotosForBooking,
  useUploadVisitPhoto,
  useStartVisit,
  useCompleteVisit,
  formatDate,
  formatSlot,
  bookingStatusMeta,
  localPhone,
  money,
  type BookingWithNames,
} from "@vagewell/shared";
import { PageHeader, Card, Pill, LoadingState, EmptyState, ErrorBanner, ConfirmModal, WarningBanner } from "@/components/ui";
import { VitalsModal, type VitalsSubject } from "@/components/ops/VitalsModal";
import { ReportUploadModal } from "@/components/ops/ReportUploadModal";
import { ReportRow } from "@/components/ops/ReportRow";
import { VisitPhotoStatus } from "@/components/ops/VisitPhotoStatus";
import { VisitPhotoStamper, type VisitPhotoStamperHandle } from "@/components/ops/VisitPhotoStamper";
import { CardAction } from "@/screens/ops/AdminAppointmentsScreen";
import { takeVisitPhoto, reverseGeocodeVisit, buildVisitPhotoSource } from "@/lib/visitPhoto";
import { openUrl } from "@/lib/signedUrl";
import { translateServiceName } from "@/lib/serviceI18n";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
  const { data: bookings, isLoading, error, refetch } = useMyAssignedBookings(true);
  const [vitals, setVitals] = useState<VitalsSubject | null>(null);
  const [reporting, setReporting] = useState<BookingWithNames | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const active = (bookings ?? []).filter((b) => b.booking_status !== "completed" && b.booking_status !== "cancelled");

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
            <PageHeader title={t("ops.myVisits.title")} subtitle={t("ops.myVisits.subtitle")} />
            {error ? <ErrorBanner message={t("ops.myVisits.loadError")} /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message={t("ops.myVisits.loading")} />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title={t("ops.myVisits.empty.title")}
              description={t("ops.myVisits.empty.description")}
            />
          )
        }
        renderItem={({ item }) => (
          <VisitCard booking={item} onVitals={() => openVitals(item)} onReport={() => setReporting(item)} />
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
  onVitals,
  onReport,
}: {
  booking: BookingWithNames;
  onVitals: () => void;
  onReport: () => void;
}) {
  const { t } = useLanguage();
  const { user, role } = useAuth();
  const status = bookingStatusMeta(booking.booking_status);
  const start = useStartVisit();
  const complete = useCompleteVisit();
  const uploadVisitPhoto = useUploadVisitPhoto();
  const stamperRef = useRef<VisitPhotoStamperHandle>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const canStart = booking.booking_status === "assigned";
  const inFlight = booking.booking_status === "in_progress" || booking.booking_status === "report_uploaded";
  // Every report for this booking, newest first — not just the latest one,
  // so a multi-file upload (or several separate uploads over time) all stay
  // reachable, each with its own View/Delete.
  const { data: reports } = useReportsForBooking(booking.id);
  const { data: visitPhotos } = useVisitPhotosForBooking(booking.id);
  const hasVisitPhoto = (visitPhotos?.length ?? 0) > 0;

  const captureVisitPhoto = async () => {
    setCapturing(true);
    try {
      const shot = await takeVisitPhoto();
      if (!shot) return; // cancelled

      // Burn the location/time directly onto the photo (GPS-camera-app
      // style) instead of only recording it as separate metadata — matches
      // what was specifically asked for, and survives even if the photo is
      // ever viewed outside this app.
      const now = new Date();
      const lines = [translateServiceName(t, booking.service_name)];
      if (shot.latitude != null && shot.longitude != null) {
        const address = await reverseGeocodeVisit(shot.latitude, shot.longitude);
        if (address) lines.push(address);
        lines.push(`Lat ${shot.latitude.toFixed(6)}°  Long ${shot.longitude.toFixed(6)}°`);
      } else {
        lines.push(t("ops.myVisits.visitPhoto.noLocation"));
      }
      lines.push(now.toLocaleString());

      const stamped = stamperRef.current
        ? await stamperRef.current.stamp(shot.uri, shot.width, shot.height, lines)
        : { uri: shot.uri, mimeType: shot.mimeType, stamped: false };
      const source = await buildVisitPhotoSource(stamped.uri, stamped.mimeType);

      await uploadVisitPhoto.mutateAsync({
        bookingId: booking.id,
        source,
        latitude: shot.latitude,
        longitude: shot.longitude,
      });
      if (!stamped.stamped) toast.warning(t("ops.myVisits.visitPhoto.stampFailed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("ops.myVisits.visitPhoto.error"));
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Card className="p-4">
      <VisitPhotoStamper ref={stamperRef} />
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">{translateServiceName(t, booking.service_name)}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {t("ops.client")} <Text className="font-medium text-purple-700 dark:text-purple-300">{booking.subject_name ?? "—"}</Text>
            {localPhone(booking.subject_phone) ? ` · ${localPhone(booking.subject_phone)}` : ""}
          </Text>
          <Text className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {formatDate(booking.start_date)} · {formatSlot(booking.time_slot)}
          </Text>
          {booking.total_amount != null ? (
            <Text className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
              {t("bookingCard.amount", { amount: money(booking.total_amount) })}
            </Text>
          ) : null}
          {booking.symptom_brief ? (
            <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("ops.myVisits.note", { note: booking.symptom_brief })}
            </Text>
          ) : null}
        </View>
        <Pill bgClass={status.bg} textClass={status.text}>{status.label}</Pill>
      </View>

      {inFlight ? (
        <View className="mt-2">
          <VisitPhotoStatus bookingId={booking.id} />
        </View>
      ) : null}

      {reports?.length ? (
        <View className="mt-3 gap-2 border-t border-gray-100 pt-3 dark:border-slate-700">
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              bookingId={booking.id}
              canDelete={!r.reviewed && (role === "admin" || r.uploaded_by === user?.id)}
            />
          ))}
        </View>
      ) : null}

      <View className="mt-3 flex-row flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-3 dark:border-slate-700">
        {canStart ? (
          <CardAction
            icon={PlayCircle}
            label={t("ops.myVisits.action.startVisit")}
            onPress={() => start.mutate(booking.id)}
            disabled={start.isPending}
          />
        ) : null}
        {inFlight ? <CardAction icon={Activity} label={t("ops.myVisits.action.vitals")} onPress={onVitals} tone="muted" /> : null}
        {/* Upload is available from `assigned` onward, not just once started —
            a caregiver shouldn't have to tap Start before a report can go up. */}
        {canStart || inFlight ? (
          <CardAction icon={UploadCloud} label={t("ops.myVisits.action.uploadReport")} onPress={onReport} tone="muted" />
        ) : null}
        {inFlight ? (
          <CardAction
            icon={Camera}
            label={hasVisitPhoto ? t("ops.myVisits.action.retakeVisitPhoto") : t("ops.myVisits.action.takeVisitPhoto")}
            onPress={captureVisitPhoto}
            tone={hasVisitPhoto ? "muted" : "brand"}
            disabled={capturing || uploadVisitPhoto.isPending}
          />
        ) : null}
        {booking.subject_phone ? (
          <CardAction icon={Phone} label={t("ops.myVisits.action.call")} onPress={() => openUrl(`tel:${booking.subject_phone}`)} tone="muted" />
        ) : null}
        {inFlight ? (
          <CardAction
            icon={CheckCircle2}
            label={t("ops.myVisits.action.complete")}
            onPress={() => setConfirmOpen(true)}
            tone="success"
            disabled={complete.isPending || !hasVisitPhoto}
          />
        ) : null}
      </View>

      {inFlight && !hasVisitPhoto ? (
        <View className="mt-3">
          <WarningBanner message={t("ops.myVisits.visitPhoto.required")} />
        </View>
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        title={t("ops.myVisits.confirmComplete.title")}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          complete.mutate(booking.id);
          setConfirmOpen(false);
        }}
        confirmLabel={t("ops.myVisits.confirmComplete.confirm")}
        cancelLabel={t("ops.myVisits.confirmComplete.cancel")}
      >
        <Text className="text-sm text-gray-600">
          {t("ops.myVisits.confirmComplete.body", { service: translateServiceName(t, booking.service_name), date: formatDate(booking.start_date) })}
        </Text>
      </ConfirmModal>
    </Card>
  );
}
