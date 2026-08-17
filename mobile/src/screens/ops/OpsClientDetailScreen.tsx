import { useEffect, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User, Users, CalendarCheck, FileText, Eye, Phone } from "lucide-react-native";
import {
  useAllProfiles,
  useFamilyMembersByAccount,
  useAllBookings,
  useAllReports,
  useMarkProfileViewedByAdmin,
  money,
  formatDate,
  formatSlot,
  formatLocalTime,
  groupByLocalDate,
  localPhone,
  bookingStatusMeta,
  profileCompletionPercent,
  GENDER_LABELS,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  type ReportUpload,
} from "@vagewell/shared";
import { PageHeader, Card, SectionCard, Pill, LoadingState, EmptyState } from "@/components/ui";
import { ProfilePhoto } from "@/components/ops/ProfilePhoto";
import { CardAction } from "@/screens/ops/AdminAppointmentsScreen";
import { useSignedUrl, openUrl } from "@/lib/signedUrl";
import { useAuth } from "@/providers/AuthProvider";
import type { ClientsStackScreenProps } from "@/navigation/types";

/**
 * SCREEN_ID: OPS_CLIENT_DETAIL — one household at a glance: the account
 * holder, their dependents, every appointment either has ever had, and every
 * report uploaded against those appointments. Condenses what the web portal
 * spreads across /patients/[accountId] and its sub-routes.
 */
export function OpsClientDetailScreen({ route, navigation }: ClientsStackScreenProps<"ClientDetail">) {
  const { accountId } = route.params;
  const { role } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useAllProfiles(true);
  const { data: dependents } = useFamilyMembersByAccount(accountId);
  const { data: bookings, isLoading: bookingsLoading } = useAllBookings(true);
  const { data: reports } = useAllReports(true);
  const markViewed = useMarkProfileViewedByAdmin();

  const profile = useMemo(() => (profiles ?? []).find((p) => p.id === accountId) ?? null, [profiles, accountId]);

  // Clears User Details' "New" pill (0029) — admin-only, since that pill is
  // specifically "has an admin looked at this yet," not any ops role.
  useEffect(() => {
    if (role === "admin" && profile && !profile.viewed_by_admin_at) {
      markViewed.mutate(profile.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, profile?.id, profile?.viewed_by_admin_at]);

  // A booking's account_id is always the primary account holder regardless of
  // which subject it's for, so this one filter already covers dependents too.
  const householdBookings = useMemo(
    () => (bookings ?? []).filter((b) => b.account_id === accountId),
    [bookings, accountId]
  );

  const householdReports = useMemo(() => {
    const ids = new Set(householdBookings.map((b) => b.id));
    return (reports ?? []).filter((r) => ids.has(r.booking_id));
  }, [reports, householdBookings]);

  const reportGroups = useMemo(() => groupByLocalDate(householdReports), [householdReports]);

  if (profilesLoading && !profile) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={["top"]}>
        <View className="p-5">
          <PageHeader title="Client" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
          <LoadingState message="Loading client…" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <PageHeader
          title={profile?.full_name ?? "Client"}
          subtitle={localPhone(profile?.phone) || undefined}
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        />

        <SectionCard icon={User} title="Details">
          {profile ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <ProfilePhoto profile={profile} size={56} />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white">{profile.full_name ?? "—"}</Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    Profile {profileCompletionPercent(profile)}% complete
                  </Text>
                </View>
                {profile.phone ? (
                  <CardAction icon={Phone} label="Call" onPress={() => openUrl(`tel:${profile.phone}`)} />
                ) : null}
              </View>
              <InfoRow label="Mobile" value={localPhone(profile.phone) || "—"} />
              <InfoRow label="Age" value={profile.age != null ? String(profile.age) : "—"} />
              <InfoRow label="Gender" value={profile.gender ? GENDER_LABELS[profile.gender] : "—"} />
              <InfoRow label="Date of birth" value={profile.date_of_birth ? formatDate(profile.date_of_birth) : "—"} />
              <InfoRow label="Address" value={profile.address || "—"} />
              <InfoRow label="Joined" value={formatDate(profile.created_at)} />
            </View>
          ) : (
            <Text className="text-sm text-gray-500 dark:text-gray-400">This account could not be found.</Text>
          )}
        </SectionCard>

        <SectionCard icon={Users} title="Family members" subtitle={`${dependents?.length ?? 0} on this account`}>
          {(dependents ?? []).length === 0 ? (
            <Text className="text-sm text-gray-500 dark:text-gray-400">No dependents added yet.</Text>
          ) : (
            <View className="gap-3">
              {(dependents ?? []).map((d) => (
                <View key={d.id} className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900 dark:text-white">{d.full_name}</Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      {d.relationship[0].toUpperCase() + d.relationship.slice(1)}
                      {d.age != null ? ` · ${d.age} yrs` : ""}
                      {localPhone(d.contact_phone) ? ` · ${localPhone(d.contact_phone)}` : ""}
                    </Text>
                  </View>
                  {d.linked_profile_id ? (
                    <Pill bgClass="bg-emerald-50 dark:bg-emerald-400/10" textClass="text-emerald-700 dark:text-emerald-400">Has own login</Pill>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </SectionCard>

        <SectionCard
          icon={CalendarCheck}
          title="Appointment history"
          subtitle={`${householdBookings.length} in total`}
        >
          {bookingsLoading && householdBookings.length === 0 ? (
            <LoadingState message="Loading appointments…" />
          ) : householdBookings.length === 0 ? (
            <Text className="text-sm text-gray-500 dark:text-gray-400">No appointments booked yet.</Text>
          ) : (
            <View className="gap-3">
              {householdBookings.map((b) => {
                const status = bookingStatusMeta(b.booking_status);
                return (
                  <View key={b.id} className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-gray-900 dark:text-white">{b.service_name}</Text>
                      <Text className="text-xs text-gray-500 dark:text-gray-400">
                        {b.subject_name ?? "—"} · {formatDate(b.start_date)} · {formatSlot(b.time_slot)}
                      </Text>
                      <Text className="text-xs text-gray-400 dark:text-gray-500">{money(b.total_amount)}</Text>
                    </View>
                    <Pill bgClass={status.bg} textClass={status.text}>{status.label}</Pill>
                  </View>
                );
              })}
            </View>
          )}
        </SectionCard>

        <SectionCard icon={FileText} title="Reports" subtitle={`${householdReports.length} uploaded`}>
          {householdReports.length === 0 ? (
            <EmptyState icon={FileText} title="No reports yet" description="Uploads appear here once a visit is done." />
          ) : (
            <View className="gap-4">
              {reportGroups.map((g) => (
                <View key={g.dateLabel} className="gap-2">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{g.dateLabel}</Text>
                  {g.items.map((r) => (
                    <ReportRow key={r.id} report={r} />
                  ))}
                </View>
              ))}
            </View>
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

/** One report line with its own signed URL — a hook per row, so each is its own component. */
function ReportRow({ report }: { report: ReportUpload }) {
  const { data: url } = useSignedUrl(MEDICAL_REPORT_BUCKET, report.storage_path);
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900 dark:text-white" numberOfLines={1}>
          {report.file_name ?? REPORT_TYPE_LABELS[report.report_type]}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {REPORT_TYPE_LABELS[report.report_type]} · {formatLocalTime(report.created_at)}
          {report.patient_name ? ` · ${report.patient_name}` : ""}
        </Text>
      </View>
      {report.reviewed ? (
        <Pill bgClass="bg-emerald-50 dark:bg-emerald-400/10" textClass="text-emerald-700 dark:text-emerald-400">Released</Pill>
      ) : (
        <Pill bgClass="bg-amber-50 dark:bg-amber-400/10" textClass="text-amber-700 dark:text-amber-400">Awaiting review</Pill>
      )}
      {url ? (
        <Pressable onPress={() => openUrl(url)} hitSlop={8} className="p-1 active:opacity-70">
          <Eye size={16} color="#4b5563" />
        </Pressable>
      ) : null}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-gray-900 dark:text-white">{value}</Text>
    </View>
  );
}
