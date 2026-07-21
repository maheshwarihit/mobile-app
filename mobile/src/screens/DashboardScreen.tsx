import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { CalendarCheck, Download, Users, FileSearch, Activity } from "lucide-react-native";
import {
  PageHeader,
  TabBar,
  Pill,
  Card,
  SelectSheet,
  SmallPrimaryButton,
  LoadingState,
  EmptyState,
  ErrorBanner,
  type Tab,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { PatientBookingCard } from "@/components/feature/PatientBookingCard";
import { PaymentReviewModal } from "@/components/feature/PaymentReviewModal";
import { VitalsModal, type VitalsSubject } from "@/components/feature/VitalsModal";
import { exportAppointmentsToExcel } from "@/lib/export";
import {
  useMyBookings,
  useAllBookings,
  useFamilyMembers,
  useAllProfiles,
  useSetUserRole,
  money,
  formatDate,
  PAYMENT_STATUS_META,
  ROLES,
  type BookingWithNames,
  type Role,
} from "@vagewell/shared";

// SCREEN_ID: DASHBOARD
export function DashboardScreen() {
  const { profile, user, role } = useAuth();
  const [tab, setTab] = useState("all");
  const isStaff = role === "staff" || role === "admin";
  const isAdmin = role === "admin";

  if (!isStaff) return <PatientView profileName={profile?.full_name ?? "Myself"} userId={user?.id ?? ""} />;

  const tabs: Tab[] = [
    { key: "all", label: "All Appointments" },
    { key: "mine", label: "My Appointments" },
    ...(isAdmin ? [{ key: "users", label: "Users" }] : []),
  ];

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <View className="flex-1 px-5 pt-4">
        <PageHeader title="Dashboard" subtitle="Manage appointments and care operations." />
        <TabBar tabs={tabs} activeKey={tab} onChange={setTab} />
        <View className="mt-4 flex-1">
          {tab === "all" ? <AdminBookingsView /> : null}
          {tab === "mine" ? <PatientView profileName={profile?.full_name ?? "Myself"} userId={user?.id ?? ""} embedded /> : null}
          {tab === "users" && isAdmin ? <UsersView /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Patient's own appointments ───────────────────────────────────
function PatientView({ profileName, userId, embedded = false }: { profileName: string; userId: string; embedded?: boolean }) {
  const { data: bookings, isLoading, error } = useMyBookings();
  const { data: deps } = useFamilyMembers();
  const depMap = useMemo(() => Object.fromEntries((deps ?? []).map((d) => [d.id, d.full_name])), [deps]);

  const list = (
    <FlatList
      data={bookings ?? []}
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
          <EmptyState icon={CalendarCheck} title="No appointments yet" description="Book a service to see it here." />
        ) : null
      }
      renderItem={({ item: b }) => (
        <PatientBookingCard
          booking={b}
          userId={userId}
          subjectName={b.family_member_id ? depMap[b.family_member_id] ?? "Dependent" : profileName}
        />
      )}
    />
  );

  if (embedded) return <View className="flex-1">{list}</View>;
  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <View className="flex-1 px-5 pt-4">
        <PageHeader title="My Appointments" subtitle="Your booked home-care visits." />
        {list}
      </View>
    </SafeAreaView>
  );
}

// ── Staff/Admin: all appointments + verification + export ────────
function AdminBookingsView() {
  const { data: bookings, isLoading, error } = useAllBookings(true);
  const [selected, setSelected] = useState<BookingWithNames | null>(null);
  const [vitalsSubject, setVitalsSubject] = useState<VitalsSubject | null>(null);
  const [exporting, setExporting] = useState(false);

  const openVitals = (r: BookingWithNames) =>
    setVitalsSubject(
      r.family_member_id
        ? { familyMemberId: r.family_member_id, name: r.subject_name ?? "Dependent" }
        : { profileId: r.account_id, name: r.subject_name ?? r.account?.full_name ?? "Patient" }
    );

  const doExport = async () => {
    setExporting(true);
    try {
      await exportAppointmentsToExcel(bookings ?? []);
    } catch {
      toast.error("Could not export. Please try again.");
    }
    setExporting(false);
  };

  return (
    <View className="flex-1">
      <View className="mb-3 flex-row justify-end">
        <SmallPrimaryButton icon={Download} onPress={doExport}>
          {exporting ? "Exporting…" : "Export to Excel"}
        </SmallPrimaryButton>
      </View>
      {error ? <ErrorBanner message="Could not load appointments." /> : null}
      {isLoading ? (
        <LoadingState message="Loading appointments…" />
      ) : (
        <FlatList
          data={bookings ?? []}
          keyExtractor={(b) => b.id}
          contentContainerClassName="gap-3 pb-6"
          ListEmptyComponent={
            <EmptyState icon={CalendarCheck} title="No appointments" description="Bookings from all users appear here." />
          }
          renderItem={({ item: r }) => (
            <AdminBookingCard booking={r} onReview={() => setSelected(r)} onVitals={() => openVitals(r)} />
          )}
        />
      )}
      <PaymentReviewModal booking={selected} onClose={() => setSelected(null)} />
      <VitalsModal open={!!vitalsSubject} subject={vitalsSubject} onClose={() => setVitalsSubject(null)} />
    </View>
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
        <Pill bgClass={m.bg} textClass={m.text}>{m.label}</Pill>
      </View>
      <View className="mt-3 flex-row gap-5 border-t border-gray-100 pt-3">
        <Pressable onPress={onReview} className="flex-row items-center gap-1 active:opacity-70">
          <FileSearch size={14} color="#9333ea" />
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

// ── Admin: role management ───────────────────────────────────────
function UsersView() {
  const { data: users, isLoading } = useAllProfiles(true);
  const setRole = useSetUserRole();
  const roleOptions = ROLES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }));

  if (isLoading) return <LoadingState message="Loading users…" />;

  return (
    <FlatList
      data={users ?? []}
      keyExtractor={(u) => u.id}
      contentContainerClassName="gap-3 pb-6"
      ListEmptyComponent={<EmptyState icon={Users} title="No users" description="Registered users appear here." />}
      renderItem={({ item: u }) => (
        <Card className="p-4">
          <Text className="text-base font-semibold text-gray-900">{u.full_name ?? "—"}</Text>
          <Text className="text-xs text-gray-500">
            {u.phone ?? "—"} · Joined {formatDate(u.created_at)}
          </Text>
          <View className="mt-3">
            <SelectSheet
              label="Role"
              value={u.role}
              options={roleOptions}
              onValueChange={(role) => setRole.mutate({ userId: u.id, role: role as Role })}
            />
          </View>
        </Card>
      )}
    />
  );
}
