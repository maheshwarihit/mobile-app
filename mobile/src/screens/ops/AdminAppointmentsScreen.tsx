import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  CalendarDays,
  FileSearch,
  UserPlus2,
  UploadCloud,
  Eye,
  MessageCircle,
  ClipboardList,
  NotebookPen,
  Plus,
} from "lucide-react-native";
import {
  useAllBookings,
  useAllReports,
  money,
  formatDate,
  formatLocalDateTime,
  paymentStatusMeta,
  bookingStatusMeta,
  waLink,
  MEDICAL_REPORT_BUCKET,
  type BookingWithNames,
  type ReportUpload,
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
import { AdminNoteModal } from "@/components/ops/AdminNoteModal";
import { NewAppointmentModal } from "@/components/ops/NewAppointmentModal";
import { assignmentMessage } from "@/lib/whatsapp";
import { useSignedUrl, openUrl } from "@/lib/signedUrl";
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
  const { data: bookings, isLoading, error, refetch } = useAllBookings(true);
  // One reports query for the whole list instead of one per card — every row
  // needs "is there a report yet?", and report_select already returns every
  // row to an ops account, so N per-booking queries would be pure waste.
  const { data: reports, refetch: refetchReports } = useAllReports(true);
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
      void refetchReports();
    }, [refetch, refetchReports])
  );

  // Newest-first already, so the first match per booking is the latest report.
  const latestReportByBooking = useMemo(() => {
    const map = new Map<string, ReportUpload>();
    for (const r of reports ?? []) if (!map.has(r.booking_id)) map.set(r.booking_id, r);
    return map;
  }, [reports]);

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
        b.service_name.toLowerCase().includes(q)
      );
    });
  }, [bookings, query, dayFrom, dayTo]);

  const hasFilter = !!dayFrom || !!dayTo;

  const header = (
    <View>
      <PageHeader
        title="All appointments"
        subtitle="Every booking across every client."
        action={<IconButton icon={Plus} onPress={() => setCreating(true)} />}
      />

      <View className="mb-4 gap-3">
        <FormInput
          label="Search by client, service, or caregiver"
          value={query}
          onChangeText={setQuery}
          placeholder="Name or service…"
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <DateField label="From" value={dayFrom} onChange={setDayFrom} placeholder="Any date" />
          </View>
          <View className="flex-1">
            <DateField label="To" value={dayTo} onChange={setDayTo} placeholder="Any date" />
          </View>
        </View>
        {hasFilter ? (
          <View className="flex-row items-center gap-3">
            <CalendarDays size={14} color="#9ca3af" />
            <Text className="flex-1 text-xs text-gray-500 dark:text-gray-400">
              Showing {filtered.length} of {bookings?.length ?? 0} appointments
            </Text>
            <TextButton
              onPress={() => {
                setDayFrom("");
                setDayTo("");
              }}
            >
              Clear dates
            </TextButton>
          </View>
        ) : null}
      </View>

      {error ? <ErrorBanner message="Could not load appointments." /> : null}
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
            <LoadingState message="Loading appointments…" />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No appointments"
              description="Bookings from all clients appear here."
            />
          )
        }
        renderItem={({ item }) => (
          <AdminBookingCard
            booking={item}
            latestReport={latestReportByBooking.get(item.id) ?? null}
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
  latestReport,
  onReview,
  onApprove,
  onUploadReport,
  onNote,
  onOpenClient,
}: {
  booking: BookingWithNames;
  latestReport: ReportUpload | null;
  onReview: () => void;
  onApprove: () => void;
  onUploadReport: () => void;
  onNote: () => void;
  onOpenClient?: () => void;
}) {
  const pay = paymentStatusMeta(booking.payment_status);
  const status = bookingStatusMeta(booking.booking_status);
  const isCancelled = booking.booking_status === "cancelled";
  const isRequested = booking.booking_status === "requested";
  const waHref = booking.assigned_to_phone ? waLink(booking.assigned_to_phone, assignmentMessage(booking)) : null;
  const { data: reportUrl } = useSignedUrl(MEDICAL_REPORT_BUCKET, latestReport?.storage_path);

  return (
    <Card className="p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-base font-semibold text-gray-900 dark:text-white">{booking.service_name}</Text>
        <View className="flex-row items-center gap-1.5">
          {!isCancelled ? <Pill bgClass={pay.bg} textClass={pay.text}>{pay.label}</Pill> : null}
          <Pill bgClass={status.bg} textClass={status.text}>{status.label}</Pill>
        </View>
      </View>

      {!isCancelled ? (
        <View className="flex-row flex-wrap gap-x-5 gap-y-2">
          <CardAction icon={FileSearch} label="Review" onPress={onReview} />
          <CardAction
            icon={NotebookPen}
            label={booking.admin_note ? "Edit Note" : "+ Note"}
            onPress={onNote}
            tone="muted"
          />
          {isRequested ? (
            <CardAction icon={UserPlus2} label="Approve & Assign" onPress={onApprove} tone="success" />
          ) : (
            <CardAction icon={UploadCloud} label="Upload Report" onPress={onUploadReport} tone="muted" />
          )}
          {reportUrl ? (
            <CardAction icon={Eye} label="View Report" onPress={() => openUrl(reportUrl)} tone="muted" />
          ) : null}
          {waHref ? (
            <CardAction icon={MessageCircle} label="WhatsApp" onPress={() => openUrl(waHref)} tone="success" />
          ) : null}
        </View>
      ) : null}

      <View className="mt-1 border-t border-gray-100 pt-1 dark:border-slate-700">
        <Pressable onPress={onOpenClient} disabled={!onOpenClient} hitSlop={4} className="active:opacity-70">
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {booking.account?.full_name ?? "—"} · Client{" "}
            <Text className="font-medium text-purple-700 dark:text-purple-300 underline">
              {booking.subject_name ?? "—"}
            </Text>
          </Text>
        </Pressable>
        <Text className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {formatDate(booking.start_date)} · {money(booking.total_amount)}
        </Text>
        {booking.assigned_to_name ? (
          <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Assigned to {booking.assigned_to_name}</Text>
        ) : null}
        {booking.admin_note ? (
          <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400" numberOfLines={2}>
            Note: {booking.admin_note}
          </Text>
        ) : null}
        {latestReport ? (
          <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            Report uploaded: {formatLocalDateTime(latestReport.created_at)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const TONES = {
  brand: { color: BRAND, text: "text-purple-600 dark:text-purple-300" },
  success: { color: "#047857", text: "text-emerald-700 dark:text-emerald-400" },
  muted: { color: "#4b5563", text: "text-gray-600 dark:text-gray-300" },
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
      className={`flex-row items-center gap-1 active:opacity-70 ${disabled ? "opacity-50" : ""}`}
    >
      <Icon size={14} color={t.color} />
      <Text className={`text-sm font-medium ${t.text}`}>{label}</Text>
    </Pressable>
  );
}
