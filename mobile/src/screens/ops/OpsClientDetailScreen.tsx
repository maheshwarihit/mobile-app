import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { User, Users, CalendarCheck, FileText, Eye, Phone, Pencil, UserPlus, X } from "lucide-react-native";
import {
  useAllProfiles,
  useFamilyMembersByAccount,
  useAllBookings,
  useAllReports,
  useMarkProfileViewedByAdmin,
  useUpdateProfile,
  profileSchema,
  money,
  formatDate,
  formatSlot,
  formatLocalTime,
  groupByLocalDate,
  localPhone,
  bookingStatusMeta,
  profileCompletionPercent,
  GENDERS,
  GENDER_LABELS,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  type ReportUpload,
  type Profile,
  type FamilyMember,
} from "@vagewell/shared";
import {
  PageHeader,
  Card,
  SectionCard,
  Pill,
  LoadingState,
  EmptyState,
  FormInput,
  DateField,
  ChoiceChips,
  TextareaInput,
  PrimaryButton,
  OutlineButton,
  Avatar,
} from "@/components/ui";
import { ProfilePhoto } from "@/components/ops/ProfilePhoto";
import { CardAction } from "@/screens/ops/AdminAppointmentsScreen";
import { DependentModal } from "@/components/feature/DependentModal";
import { useSignedUrl, openUrl } from "@/lib/signedUrl";
import { useAuth } from "@/providers/AuthProvider";
import type { ClientsStackScreenProps } from "@/navigation/types";

const GENDER_OPTIONS = GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }));

/**
 * SCREEN_ID: OPS_CLIENT_DETAIL — one household at a glance: the account
 * holder, their dependents, every appointment either has ever had, and every
 * report uploaded against those appointments. Condenses what the web portal
 * spreads across /patients/[accountId] and its sub-routes.
 */
export function OpsClientDetailScreen({ route, navigation }: ClientsStackScreenProps<"ClientDetail">) {
  const { accountId, memberId } = route.params;
  const { role } = useAuth();
  const { data: profiles, isLoading: profilesLoading, refetch: refetchProfiles } = useAllProfiles(true);
  const { data: dependents, refetch: refetchDependents } = useFamilyMembersByAccount(accountId);
  const { data: bookings, isLoading: bookingsLoading, refetch: refetchBookings } = useAllBookings(true);
  const { data: reports, refetch: refetchReports } = useAllReports(true);
  const markViewed = useMarkProfileViewedByAdmin();
  // Editing is open to both ops roles — profiles_update RLS already grants
  // any is_staff() caller (admin or leaf_node), not just admin, and a Care
  // Assistant correcting a client's details on the spot during a visit is a
  // normal case too, not just something for the office.
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingDependent, setEditingDependent] = useState<FamilyMember | null>(null);
  const [addingDependent, setAddingDependent] = useState(false);

  // Belt-and-braces, same fix already applied to DashboardScreen/ProfileScreen
  // for the same class of bug: these are all shared, cross-screen query caches
  // (e.g. useAllProfiles also backs AdminTeamScreen/OpsClientsScreen) — a
  // change made elsewhere (a client uploading their own photo, editing their
  // bio) has no way to tell an already-open admin tab anything changed, so
  // this refetches everything fresh every time the screen regains focus
  // instead of trusting whatever was cached from an earlier visit.
  useFocusEffect(
    useCallback(() => {
      void refetchProfiles();
      void refetchDependents();
      void refetchBookings();
      void refetchReports();
    }, [refetchProfiles, refetchDependents, refetchBookings, refetchReports])
  );

  const profile = useMemo(() => (profiles ?? []).find((p) => p.id === accountId) ?? null, [profiles, accountId]);
  // Which person this page is actually about — the account holder by
  // default, or a specific dependent when opened via memberId (a family
  // member row tapped from the Clients list). Previously this page always
  // showed the account holder regardless of which row was tapped.
  const focusedDependent = useMemo(
    () => (memberId ? (dependents ?? []).find((d) => d.id === memberId) ?? null : null),
    [memberId, dependents]
  );

  // Clears User Details' "New" pill (0029) — admin-only, since that pill is
  // specifically "has an admin looked at this yet," not any ops role.
  useEffect(() => {
    if (role === "admin" && profile && !profile.viewed_by_admin_at) {
      markViewed.mutate(profile.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, profile?.id, profile?.viewed_by_admin_at]);

  // A booking's account_id is always the primary account holder regardless of
  // which subject it's for, so this one filter already covers dependents too
  // — the account holder's own page (no memberId) intentionally keeps showing
  // the whole household combined, unchanged. Focused on one dependent
  // specifically, narrowed further to just their own bookings
  // (family_member_id) instead of the whole household's.
  const householdBookings = useMemo(
    () => (bookings ?? []).filter((b) => b.account_id === accountId),
    [bookings, accountId]
  );
  const subjectBookings = useMemo(
    () => (focusedDependent ? householdBookings.filter((b) => b.family_member_id === focusedDependent.id) : householdBookings),
    [householdBookings, focusedDependent]
  );

  const subjectReports = useMemo(() => {
    const ids = new Set(subjectBookings.map((b) => b.id));
    return (reports ?? []).filter((r) => ids.has(r.booking_id));
  }, [reports, subjectBookings]);

  const reportGroups = useMemo(() => groupByLocalDate(subjectReports), [subjectReports]);

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
          title={focusedDependent ? focusedDependent.full_name : profile?.full_name ?? "Client"}
          subtitle={
            focusedDependent
              ? `${focusedDependent.relationship[0].toUpperCase()}${focusedDependent.relationship.slice(1)} · part of ${profile?.full_name ?? "—"}'s household`
              : localPhone(profile?.phone) || undefined
          }
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        />

        {focusedDependent ? (
          <Pressable
            onPress={() => navigation.setParams({ memberId: undefined })}
            hitSlop={4}
            className="mb-4 self-start active:opacity-70"
          >
            <Text className="text-xs font-medium text-purple-600 underline dark:text-purple-300">
              View {profile?.full_name ?? "account holder"}&apos;s own profile
            </Text>
          </Pressable>
        ) : null}

        <SectionCard icon={User} title="Details">
          {focusedDependent ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <Avatar name={focusedDependent.full_name} id={focusedDependent.id} size="md" />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white">{focusedDependent.full_name}</Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    Profile {profileCompletionPercent(focusedDependent)}% complete
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  {focusedDependent.contact_phone ? (
                    <CardAction icon={Phone} label="Call" onPress={() => openUrl(`tel:${focusedDependent.contact_phone}`)} />
                  ) : null}
                  <CardAction icon={Pencil} label="Edit" onPress={() => setEditingDependent(focusedDependent)} tone="muted" />
                </View>
              </View>
              <InfoRow
                label="Relationship"
                value={`${focusedDependent.relationship[0].toUpperCase()}${focusedDependent.relationship.slice(1)}`}
              />
              <InfoRow label="Contact number" value={localPhone(focusedDependent.contact_phone) || "—"} />
              <InfoRow label="Age" value={focusedDependent.age != null ? String(focusedDependent.age) : "—"} />
              <InfoRow label="Gender" value={focusedDependent.gender ? GENDER_LABELS[focusedDependent.gender] : "—"} />
              <InfoRow
                label="Date of birth"
                value={focusedDependent.date_of_birth ? formatDate(focusedDependent.date_of_birth) : "—"}
              />
              {focusedDependent.linked_profile_id ? (
                <InfoRow label="Login" value="Has own login" />
              ) : null}
            </View>
          ) : profile ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <ProfilePhoto profile={profile} size={56} />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white">{profile.full_name ?? "—"}</Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    Profile {profileCompletionPercent(profile)}% complete
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  {profile.phone ? (
                    <CardAction icon={Phone} label="Call" onPress={() => openUrl(`tel:${profile.phone}`)} />
                  ) : null}
                  <CardAction icon={Pencil} label="Edit" onPress={() => setEditingProfile(true)} tone="muted" />
                </View>
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
            <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">No dependents added yet.</Text>
          ) : (
            <View className="mb-3 gap-3">
              {(dependents ?? []).map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => navigation.setParams({ memberId: d.id })}
                  className={`flex-row items-center justify-between gap-3 rounded-lg p-2 active:opacity-70 ${
                    d.id === memberId ? "bg-purple-50 dark:bg-purple-400/10" : ""
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900 dark:text-white">{d.full_name}</Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      {d.relationship[0].toUpperCase() + d.relationship.slice(1)}
                      {d.age != null ? ` · ${d.age} yrs` : ""}
                      {localPhone(d.contact_phone) ? ` · ${localPhone(d.contact_phone)}` : ""}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      Profile {profileCompletionPercent(d)}% complete
                    </Text>
                  </View>
                  <View className="items-end gap-1.5">
                    {d.linked_profile_id ? (
                      <Pill bgClass="bg-emerald-50 dark:bg-emerald-400/10" textClass="text-emerald-700 dark:text-emerald-400">Has own login</Pill>
                    ) : null}
                    <Pressable
                      onPress={(e) => {
                        // Stops the outer row's own onPress (focus-navigate)
                        // from also firing — nested Pressables bubble on web.
                        e.stopPropagation();
                        setEditingDependent(d);
                      }}
                      hitSlop={8}
                      className="p-1 active:opacity-70"
                    >
                      <Pencil size={16} color="#6b7280" />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          <CardAction icon={UserPlus} label="Add family member" onPress={() => setAddingDependent(true)} />
        </SectionCard>

        <SectionCard
          icon={CalendarCheck}
          title="Appointment history"
          subtitle={focusedDependent ? `${subjectBookings.length} for ${focusedDependent.full_name}` : `${subjectBookings.length} in total`}
        >
          {bookingsLoading && subjectBookings.length === 0 ? (
            <LoadingState message="Loading appointments…" />
          ) : subjectBookings.length === 0 ? (
            <Text className="text-sm text-gray-500 dark:text-gray-400">No appointments booked yet.</Text>
          ) : (
            <View className="gap-3">
              {subjectBookings.map((b) => {
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

        <SectionCard icon={FileText} title="Reports" subtitle={`${subjectReports.length} uploaded`}>
          {subjectReports.length === 0 ? (
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

      {profile ? (
        <EditProfileModal
          open={editingProfile}
          profile={profile}
          onClose={() => setEditingProfile(false)}
          onSaved={() => void refetchProfiles()}
        />
      ) : null}
      <DependentModal
        open={editingDependent !== null || addingDependent}
        dependent={editingDependent}
        accountId={accountId}
        onClose={() => {
          setEditingDependent(null);
          setAddingDependent(false);
          void refetchDependents();
        }}
      />
    </SafeAreaView>
  );
}

/** Full Name/Age/DOB/Gender/Address — same fields and validation as the
 * patient's own self-edit form (ProfileScreen), open to admin and Care
 * Assistant alike here since a client can't always reach their own device to
 * fix a typo, and profiles_update RLS already permits either ops role. */
function EditProfileModal({
  open,
  profile,
  onClose,
  onSaved,
}: {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState({ full_name: "", age: "", date_of_birth: "", gender: "male", address: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm({
        full_name: profile.full_name ?? "",
        age: profile.age?.toString() ?? "",
        date_of_birth: profile.date_of_birth ?? "",
        gender: profile.gender ?? "male",
        address: profile.address ?? "",
      });
    }
  }, [open, profile]);

  const submit = () => {
    setErrors({});
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    updateProfile.mutate(
      {
        id: profile.id,
        full_name: parsed.data.full_name,
        age: parsed.data.age,
        date_of_birth: parsed.data.date_of_birth || null,
        gender: parsed.data.gender || null,
        address: parsed.data.address || null,
      },
      {
        onSuccess: () => {
          onSaved();
          onClose();
        },
      }
    );
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
          <Pressable style={{ maxHeight: "85%" }} className="w-full max-w-md rounded-2xl border border-gray-100 bg-white" onPress={() => {}}>
            <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-lg font-bold text-gray-900">Edit details</Text>
                <Pressable onPress={onClose} hitSlop={8}>
                  <X size={18} color="#9ca3af" />
                </Pressable>
              </View>
              <View className="gap-4">
                <FormInput label="Full Name" value={form.full_name} onChangeText={set("full_name")} error={errors.full_name} autoCapitalize="words" required />
                <FormInput label="Age (optional)" value={form.age} onChangeText={set("age")} placeholder="Age" keyboardType="number-pad" error={errors.age} />
                <DateField label="Date of birth (optional)" value={form.date_of_birth} onChange={set("date_of_birth")} />
                <ChoiceChips label="Gender" value={form.gender} onChange={set("gender")} options={GENDER_OPTIONS} />
                <TextareaInput label="Address" value={form.address} onChangeText={set("address")} placeholder="House/street, city, pincode…" rows={2} maxLength={500} />
              </View>
              <View className="mt-6 flex-row justify-end gap-2">
                <OutlineButton onPress={onClose}>Cancel</OutlineButton>
                <PrimaryButton loading={updateProfile.isPending} onPress={submit}>
                  Save
                </PrimaryButton>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
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
