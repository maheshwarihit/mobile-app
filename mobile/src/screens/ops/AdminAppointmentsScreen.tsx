import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  CalendarDays,
  FileSearch,
  UserPlus2,
  UploadCloud,
  MessageCircle,
  ClipboardList,
  NotebookPen,
  Plus,
  Wallet,
  UserCheck,
} from "lucide-react-native";
import {
  useAllBookings,
  useReportsForBooking,
  money,
  formatDate,
  paymentStatusMeta,
  bookingStatusMeta,
  waLink,
  type BookingWithNames,
} from "@vagewell/shared";
import {
  PageHeader,
  Card,
  Pill,
  FormInput,
  DateField,
  LoadingState,
  EmptyState,
  ErrorBanner,
  TextButton,
  IconButton,
} from "@/components/ui";
import { PaymentReviewModal } from "@/components/ops/PaymentReviewModal";
import { ApproveAssignModal } from "@/components/ops/ApproveAssignModal";
import { ReportUploadModal } from "@/components/ops/ReportUploadModal";
import { ReportRow } from "@/components/ops/ReportRow";
import { VisitPhotoStatus } from "@/components/ops/VisitPhotoStatus";
import { AdminNoteModal } from "@/components/ops/AdminNoteModal";
import { NewAppointmentModal } from "@/components/ops/NewAppointmentModal";
import { assignmentMessage } from "@/lib/whatsapp";
import { openUrl } from "@/lib/signedUrl";
import { iconForService } from "@/lib/serviceIcon";
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";
import { BRAND } from "@/theme";

/**
 * SCREEN_ID: ADMIN_DASHBOARD — every appointment across every account, with the
 * full admin workflow (review payment, approve & assign, upload/view report,
 * message the assigned caregiver). Port of web/src/app/dashboard/page.tsx.
 *
 * Admin-only by navigation (see AdminNavigator) and by the DB regardless: a
 * leaf_node can *see* every booking (bk_select, 0016) but can only act on the
 * ones assigned to them, which is what the Visits tab is for.
 */
export function AdminAppointmentsScreen({ onOpenClient }: { onOpenClient?: (accountId: string) => void }) {
  const { t } = useLanguage();
  const { data: bookings, isLoading, error, refetch } = useAllBookings(true);
  const [query, setQuery] = useState("");
  const [dayFrom, setDayFrom] = useState("");
  const [dayTo, setDayTo] = useState("");
  const [reviewing, setReviewing] = useState<BookingWithNames | null>(null);
  const [approving, setApproving] = useState<BookingWithNames | null>(null);
  const [reporting, setReporting] = useState<BookingWithNames | null>(null);
  const [noting, setNoting] = useState<BookingWithNames | null>(null);
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bookings ?? []).filter((b) => {
      if (dayFrom && b.start_date < dayFrom) return false;
      if (dayTo && b.start_date > dayTo) return false;
      if (!q) return true;
      // Matches only what the label promises (client, service, caregiver).
      // Matching the account holder's name too used to pull in unrelated
      // bookings whenever a *different* account holder's name happened to
      // share a substring with the client actually being searched for.
      return (
        (b.subject_name ?? "").toLowerCase().includes(q) ||
        (b.assigned_to_name ?? "").toLowerCase().includes(q) ||
        (b.assigned_to_display_name ?? "").toLowerCase().includes(q) ||
        b.service_name.toLowerCase().includes(q)
      );
    });
  }, [bookings, query, dayFrom, dayTo]);

  const hasFilter = !!dayFrom || !!dayTo;

  const header = (
    <View>
      <PageHeader
        title={t("ops.appointments.title")}
        subtitle={t("ops.appointments.subtitle")}
        action={<IconButton icon={Plus} onPress={() => setCreating(true)} />}
      />

      <View className="mb-4 gap-3">
        <FormInput
          label={t("ops.appointments.search")}
          value={query}
          onChangeText={setQuery}
          placeholder={t("ops.appointments.searchPlaceholder")}
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <DateField label={t("ops.appointments.from")} value={dayFrom} onChange={setDayFrom} placeholder={t("ops.appointments.anyDate")} />
          </View>
          <View className="flex-1">
            <DateField label={t("ops.appointments.to")} value={dayTo} onChange={setDayTo} placeholder={t("ops.appointments.anyDate")} />
          </View>
        </View>
        {hasFilter ? (
          <View className="flex-row items-center gap-3">
            <CalendarDays size={14} color="#9ca3af" />
            <Text className="flex-1 text-xs text-gray-500 dark:text-gray-400">
              {t("ops.appointments.showingCount", { shown: filtered.length, total: bookings?.length ?? 0 })}
            </Text>
            <TextButton
              onPress={() => {
                setDayFrom("");
                setDayTo("");
              }}
            >
              {t("ops.appointments.clearDates")}
            </TextButton>
          </View>
        ) : null}
      </View>

      {error ? <ErrorBanner message={t("ops.appointments.loadError")} /> : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message={t("ops.appointments.loading")} />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title={t("ops.appointments.empty.title")}
              description={t("ops.appointments.empty.description")}
            />
          )
        }
        renderItem={({ item }) => (
          <AdminBookingCard
            booking={item}
            onReview={() => setReviewing(item)}
            onApprove={() => setApproving(item)}
            onUploadReport={() => setReporting(item)}
            onNote={() => setNoting(item)}
            onOpenClient={onOpenClient ? () => onOpenClient(item.account_id) : undefined}
          />
        )}
      />

      {reviewing ? (
        <PaymentReviewModal key={reviewing.id} booking={reviewing} onClose={() => setReviewing(null)} />
      ) : null}
      {approving ? (
        <ApproveAssignModal key={approving.id} booking={approving} onClose={() => setApproving(null)} />
      ) : null}
      {reporting ? (
        <ReportUploadModal key={reporting.id} booking={reporting} onClose={() => setReporting(null)} />
      ) : null}
      <NewAppointmentModal visible={creating} onClose={() => setCreating(false)} />
      {noting ? <AdminNoteModal key={noting.id} booking={noting} onClose={() => setNoting(null)} /> : null}
    </SafeAreaView>
  );
}

function AdminBookingCard({
  booking,
  onReview,
  onApprove,
  onUploadReport,
  onNote,
  onOpenClient,
}: {
  booking: BookingWithNames;
  onReview: () => void;
  onApprove: () => void;
  onUploadReport: () => void;
  onNote: () => void;
  onOpenClient?: () => void;
}) {
  const { t } = useLanguage();
  const pay = paymentStatusMeta(booking.payment_status);
  const status = bookingStatusMeta(booking.booking_status);
  const isCancelled = booking.booking_status === "cancelled";
  const isRequested = booking.booking_status === "requested";
  const waHref = booking.assigned_to_phone ? waLink(booking.assigned_to_phone, assignmentMessage(booking)) : null;
  const ServiceIcon = iconForService(booking.service_name);
  // Every report for this booking, not just the latest — admin can view or
  // remove any of them (report_delete RLS grants admin unconditionally,
  // unlike a caregiver's own not-yet-released-only removal).
  const { data: reports } = useReportsForBooking(booking.id);

  return (
    <Card className="rounded-2xl p-5">
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-slate-700">
          <ServiceIcon size={22} color={BRAND} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900 dark:text-white">{translateServiceName(t, booking.service_name)}</Text>
          <Pressable onPress={onOpenClient} disabled={!onOpenClient} hitSlop={4} className="mt-0.5 active:opacity-70">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {booking.account?.full_name ?? "—"} · {t("ops.client")}{" "}
              <Text className="font-semibold text-purple-600 underline dark:text-purple-300">
                {booking.subject_name ?? "—"}
              </Text>
            </Text>
          </Pressable>
        </View>
        <View className="items-end gap-1.5">
          {!isCancelled ? <Pill bgClass={pay.bg} textClass={pay.text}>{pay.label}</Pill> : null}
          <Pill bgClass={status.bg} textClass={status.text}>{status.label}</Pill>
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-2">
        <InfoPill icon={CalendarDays} text={formatDate(booking.start_date)} />
        {booking.total_amount != null ? (
          <InfoPill icon={Wallet} text={money(booking.total_amount)} />
        ) : null}
        {booking.assigned_to_name ? (
          <InfoPill icon={UserCheck} text={booking.assigned_to_display_name ?? booking.assigned_to_name} />
        ) : null}
      </View>

      {booking.admin_note ? (
        <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400" numberOfLines={2}>
          {t("ops.appointments.note", { note: booking.admin_note })}
        </Text>
      ) : null}
      {!isCancelled && (booking.booking_status === "in_progress" || booking.booking_status === "report_uploaded") ? (
        <View className="mt-2">
          <VisitPhotoStatus bookingId={booking.id} />
        </View>
      ) : null}
      {reports?.length ? (
        <View className="mt-3 gap-2 border-t border-gray-100 pt-3 dark:border-slate-700">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} bookingId={booking.id} canDelete />
          ))}
        </View>
      ) : null}

      {!isCancelled ? (
        <View className="mt-4 flex-row flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-slate-700">
          <CardAction icon={FileSearch} label={t("ops.appointments.action.review")} onPress={onReview} />
          <CardAction
            icon={Wallet}
            label={booking.total_amount != null ? t("ops.appointments.action.editPrice") : t("ops.appointments.action.addPrice")}
            onPress={onReview}
            tone="success"
          />
          <CardAction
            icon={NotebookPen}
            label={booking.admin_note ? t("ops.appointments.action.editNote") : t("ops.appointments.action.addNote")}
            onPress={onNote}
            tone="muted"
          />
          {isRequested ? (
            <CardAction icon={UserPlus2} label={t("ops.appointments.action.approveAssign")} onPress={onApprove} tone="success" />
          ) : (
            <CardAction icon={UploadCloud} label={t("ops.appointments.action.uploadReport")} onPress={onUploadReport} tone="muted" />
          )}
          {waHref ? (
            <CardAction icon={MessageCircle} label={t("ops.appointments.action.whatsapp")} onPress={() => openUrl(waHref)} tone="success" />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/** Small rounded info badge — date/amount/assignee, matching the reference's location/rate pills. */
function InfoPill({ icon: Icon, text }: { icon: React.ComponentType<{ size?: number; color?: string }>; text: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 dark:bg-slate-700">
      <Icon size={13} color="#6b7280" />
      <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{text}</Text>
    </View>
  );
}

const TONES = {
  brand: { color: BRAND, bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-300" },
  success: { color: "#047857", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
  muted: { color: "#4b5563", bg: "bg-gray-100 dark:bg-slate-700", text: "text-gray-600 dark:text-gray-300" },
} as const;

export function CardAction({
  icon: Icon,
  label,
  onPress,
  tone = "brand",
  disabled,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  tone?: keyof typeof TONES;
  disabled?: boolean;
}) {
  const t = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 active:opacity-70 ${t.bg} ${disabled ? "opacity-50" : ""}`}
    >
      <Icon size={14} color={t.color} />
      <Text className={`text-xs font-semibold ${t.text}`}>{label}</Text>
    </Pressable>
  );
}
