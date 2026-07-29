import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { UserCircle, Users, Activity, Pencil, Trash2, Plus, Lock, LogOut, FileText, Download } from "lucide-react-native";
import {
  PageHeader,
  SectionCard,
  FormInput,
  SelectSheet,
  ChoiceChips,
  DateField,
  PrimaryButton,
  OutlineButton,
  IconButton,
  EmptyState,
  LoadingState,
  ConfirmModal,
  Pill,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { DependentModal } from "@/components/feature/DependentModal";
import { supabase } from "@/lib/supabase";
import {
  useFamilyMembers,
  useClinicalRecords,
  useUpdateProfile,
  useDeleteDependent,
  useMyReports,
  useMyBookings,
  profileSchema,
  formatDate,
  formatLocalDateTime,
  localPhone,
  GENDERS,
  GENDER_LABELS,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type FamilyMember,
  type ClinicalRecord,
  type ReportUpload,
} from "@vagewell/shared";

const GENDER_OPTIONS = [{ value: "", label: "—" }, ...GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))];

// SCREEN_ID: PROFILE
export function ProfileScreen() {
  const { profile, user, loading, refreshProfile, signOut } = useAuth();
  const { data: dependents, isLoading: depsLoading } = useFamilyMembers();
  const update = useUpdateProfile();
  const del = useDeleteDependent();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", age: "", date_of_birth: "", gender: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [depModalOpen, setDepModalOpen] = useState(false);
  const [editingDep, setEditingDep] = useState<FamilyMember | null>(null);
  const [deleteDep, setDeleteDep] = useState<FamilyMember | null>(null);

  const [subject, setSubject] = useState("self");

  const startEdit = () => {
    setErrors({});
    setForm({
      full_name: profile?.full_name ?? "",
      age: profile?.age?.toString() ?? "",
      date_of_birth: profile?.date_of_birth ?? "",
      gender: profile?.gender ?? "",
    });
    setEditing(true);
  };

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveBio = () => {
    setErrors({});
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    if (!user) return;
    update.mutate(
      {
        id: user.id,
        full_name: parsed.data.full_name,
        age: parsed.data.age,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
      },
      {
        onSuccess: () => {
          // Collapse to the read-only rows immediately — qk.profile is already
          // invalidated and the toast has fired; don't wait on the auth-provider
          // refetch round-trip.
          setEditing(false);
          void refreshProfile();
        },
      }
    );
  };

  const subjectOptions = [
    { value: "self", label: "Myself" },
    ...(dependents ?? []).map((d) => ({ value: d.id, label: d.full_name })),
  ];
  const subjectQuery = useMemo(
    () => (subject === "self" ? { profileId: user?.id } : { familyMemberId: subject }),
    [subject, user?.id]
  );
  const { data: records, isLoading: vitalsLoading } = useClinicalRecords(user ? subjectQuery : null);

  // Reports released to the customer are shown alongside vitals in the Health
  // record, scoped to whichever subject (self/dependent) is selected above —
  // reports don't carry a direct subject column, so match through their booking.
  const { data: reports, isLoading: reportsLoading } = useMyReports(true);
  const { data: myBookings } = useMyBookings();
  const reportsForSubject = useMemo(() => {
    const bookingMap = new Map((myBookings ?? []).map((b) => [b.id, b]));
    return (reports ?? []).filter((r) => {
      const b = bookingMap.get(r.booking_id);
      if (!b) return false;
      return subject === "self" ? !b.family_member_id : b.family_member_id === subject;
    });
  }, [reports, myBookings, subject]);

  const openReport = async (r: ReportUpload) => {
    const { data, error: signErr } = await supabase.storage
      .from(MEDICAL_REPORT_BUCKET)
      .createSignedUrl(r.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !data?.signedUrl) {
      toast.error("Could not open this report. Please try again.");
      return;
    }
    Linking.openURL(data.signedUrl);
  };

  if (loading) return <LoadingState message="Loading profile…" />;

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pt-4 pb-10" keyboardShouldPersistTaps="handled">
        <PageHeader title="Profile" subtitle="Your details, dependents, and health record." />

        {/* ── Bio ─────────────────────────────────────────── */}
        <SectionCard icon={UserCircle} title="Your details">
          {!editing ? (
            <View>
              <View className="gap-2">
                <Row label="Name" value={profile?.full_name ?? "—"} />
                <Row label="Mobile" value={localPhone(profile?.phone) || "—"} />
                <Row label="Age" value={profile?.age?.toString() ?? "—"} />
                <Row label="Date of birth" value={profile?.date_of_birth ? formatDate(profile.date_of_birth) : "—"} />
                <Row label="Gender" value={profile?.gender ? GENDER_LABELS[profile.gender] : "—"} />
              </View>
              <View className="mt-4">
                <OutlineButton icon={Pencil} onPress={startEdit}>
                  Edit details
                </OutlineButton>
              </View>
            </View>
          ) : (
            <View className="gap-4">
              <FormInput label="Full name" value={form.full_name} onChangeText={set("full_name")} error={errors.full_name} autoCapitalize="words" required />
              <FormInput label="Mobile (verified)" value={localPhone(profile?.phone)} onChangeText={() => {}} editable={false} />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FormInput label="Age" value={form.age} onChangeText={set("age")} keyboardType="number-pad" error={errors.age} />
                </View>
                <View className="flex-1">
                  <DateField label="Date of birth" value={form.date_of_birth} onChange={set("date_of_birth")} placeholder="Select" />
                </View>
              </View>
              <ChoiceChips label="Gender" value={form.gender} onChange={set("gender")} options={GENDER_OPTIONS} />
              <View className="flex-row justify-end gap-2">
                <OutlineButton onPress={() => setEditing(false)}>Cancel</OutlineButton>
                <PrimaryButton loading={update.isPending} onPress={saveBio}>
                  Save
                </PrimaryButton>
              </View>
            </View>
          )}
        </SectionCard>

        {/* ── Dependents ──────────────────────────────────── */}
        <SectionCard
          icon={Users}
          title="Dependents"
          subtitle="Family members you can book care for. They can register with the same phone number to get their own login."
        >
          {depsLoading ? (
            <LoadingState message="Loading dependents…" />
          ) : (dependents?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Users}
              title="No dependents yet"
              description="Add a family member to book care for them."
              actionLabel="Add dependent"
              onAction={() => {
                setEditingDep(null);
                setDepModalOpen(true);
              }}
            />
          ) : (
            <View className="gap-2">
              {dependents?.map((d) => (
                <View key={d.id} className="flex-row items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-sm font-medium text-gray-900">{d.full_name}</Text>
                      <Pill bgClass={d.linked_profile_id ? "bg-emerald-50" : "bg-gray-100"} textClass={d.linked_profile_id ? "text-emerald-700" : "text-gray-500"}>
                        {d.linked_profile_id ? "Has own login" : "Not registered yet"}
                      </Pill>
                    </View>
                    <Text className="text-xs capitalize text-gray-500">
                      {d.relationship}
                      {d.age != null ? ` · ${d.age} yrs` : ""}
                      {d.contact_phone ? ` · ${localPhone(d.contact_phone)}` : ""}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <IconButton icon={Pencil} onPress={() => { setEditingDep(d); setDepModalOpen(true); }} />
                    <IconButton icon={Trash2} danger onPress={() => setDeleteDep(d)} />
                  </View>
                </View>
              ))}
            </View>
          )}
          {(dependents?.length ?? 0) > 0 ? (
            <View className="mt-4">
              <OutlineButton icon={Plus} onPress={() => { setEditingDep(null); setDepModalOpen(true); }}>
                Add dependent
              </OutlineButton>
            </View>
          ) : null}
        </SectionCard>

        {/* ── Health record (read-only) ───────────────────── */}
        <SectionCard icon={Activity} title="Health record" subtitle="Vitals recorded by care staff.">
          <View className="mb-4 flex-row items-center gap-2">
            <Lock size={13} color="#9ca3af" />
            <Text className="flex-1 text-xs text-gray-400">Read-only — updated by VAgeWell staff during visits.</Text>
          </View>
          <View className="mb-4">
            <SelectSheet label="View record for" value={subject} onValueChange={setSubject} options={subjectOptions} />
          </View>
          {vitalsLoading ? <LoadingState message="Loading vitals…" /> : <VitalsView records={records ?? []} />}

          <View className="mt-4 border-t border-gray-100 pt-4">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Reports</Text>
            {reportsLoading ? (
              <LoadingState message="Loading reports…" />
            ) : reportsForSubject.length === 0 ? (
              <Text className="text-xs text-gray-400">No reports released yet for this person.</Text>
            ) : (
              <View className="gap-2">
                {reportsForSubject.map((r) => (
                  <Pressable key={r.id} onPress={() => openReport(r)}>
                    <View className="flex-row items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                      <View className="h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                        <FileText size={15} color="#7c3aed" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-medium text-gray-900">{REPORT_TYPE_LABELS[r.report_type]}</Text>
                        <Text className="text-[11px] text-gray-500">Uploaded: {formatLocalDateTime(r.created_at)}</Text>
                      </View>
                      <Download size={14} color="#9ca3af" />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </SectionCard>

        <OutlineButton icon={LogOut} fullWidth onPress={signOut}>
          Sign out
        </OutlineButton>
      </ScrollView>

      <DependentModal
        open={depModalOpen}
        dependent={editingDep}
        accountId={user?.id ?? ""}
        onClose={() => setDepModalOpen(false)}
      />

      <ConfirmModal
        open={!!deleteDep}
        title="Remove dependent?"
        onClose={() => setDeleteDep(null)}
        onConfirm={() => {
          if (deleteDep) del.mutate(deleteDep.id);
          setDeleteDep(null);
        }}
        confirmLabel="Remove"
        cancelLabel="Keep"
        confirmDanger
      >
        <Text className="text-sm text-gray-600">Remove {deleteDep?.full_name} from your dependents?</Text>
      </ConfirmModal>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm font-medium text-gray-900">{value}</Text>
    </View>
  );
}

function VitalsView({ records }: { records: ClinicalRecord[] }) {
  // Patient panel shows only Sugar (blood glucose) + Blood Group.
  // `records` is ordered recorded_at desc and each visit is saved as its own
  // dated row carrying only the fields staff filled in — so read the most recent
  // NON-NULL value per field. Taking records[0] wholesale would blank out a blood
  // group captured on an earlier visit (there is no History list to fall back on).
  const sugar = records.find((r) => r.blood_glucose != null)?.blood_glucose ?? null;
  const bloodGroup = records.find((r) => !!r.blood_group)?.blood_group ?? null;
  if (sugar == null && bloodGroup == null) {
    return (
      <EmptyState
        icon={Activity}
        title="No records yet"
        description="Care staff will record your sugar and blood group during a visit."
      />
    );
  }
  const tiles = [
    { label: "Sugar", value: sugar?.toString() ?? "—", unit: "mg/dL" },
    { label: "Blood Group", value: bloodGroup ?? "—", unit: "" },
  ];
  return (
    <View className="flex-row flex-wrap gap-3">
      {tiles.map((t) => (
        <View key={t.label} className="min-w-[45%] flex-1 items-center rounded-xl border border-gray-100 bg-white p-3">
          <Text className="text-lg font-bold text-gray-900">{t.value}</Text>
          <Text className="text-[10px] text-gray-400">{t.unit}</Text>
          <Text className="mt-1 text-[11px] font-medium text-gray-500">{t.label}</Text>
        </View>
      ))}
    </View>
  );
}
