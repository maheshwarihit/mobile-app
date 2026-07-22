import { useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserCircle, Users, Activity, Pencil, Trash2, Plus, Lock, LogOut } from "lucide-react-native";
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
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { DependentModal } from "@/components/feature/DependentModal";
import {
  useFamilyMembers,
  useClinicalRecords,
  useUpdateProfile,
  useDeleteDependent,
  profileSchema,
  formatDate,
  formatLocalDateTime,
  localPhone,
  GENDERS,
  GENDER_LABELS,
  type FamilyMember,
  type ClinicalRecord,
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
        onSuccess: async () => {
          await refreshProfile();
          setEditing(false);
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
        <SectionCard icon={Users} title="Dependents" subtitle="Family members you can book care for.">
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
                    <Text className="text-sm font-medium text-gray-900">{d.full_name}</Text>
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
  if (records.length === 0) {
    return (
      <EmptyState icon={Activity} title="No vitals recorded" description="Care staff will record vitals during a visit." />
    );
  }
  const latest = records[0];
  const bp = latest.systolic && latest.diastolic ? `${latest.systolic}/${latest.diastolic}` : "—";
  const tiles = [
    { label: "Blood Pressure", value: bp, unit: "mmHg" },
    { label: "Glucose", value: latest.blood_glucose?.toString() ?? "—", unit: "mg/dL" },
    { label: "SpO2", value: latest.spo2?.toString() ?? "—", unit: "%" },
    { label: "Blood Group", value: latest.blood_group ?? "—", unit: "" },
  ];
  return (
    <View>
      <View className="flex-row flex-wrap gap-3">
        {tiles.map((t) => (
          <View key={t.label} className="min-w-[45%] flex-1 items-center rounded-xl border border-gray-100 bg-white p-3">
            <Text className="text-lg font-bold text-gray-900">{t.value}</Text>
            <Text className="text-[10px] text-gray-400">{t.unit}</Text>
            <Text className="mt-1 text-[11px] font-medium text-gray-500">{t.label}</Text>
          </View>
        ))}
      </View>

      {latest.medical_conditions ? (
        <View className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <Text className="text-xs font-semibold text-gray-500">Medical conditions</Text>
          <Text className="mt-1 text-sm text-gray-700">{latest.medical_conditions}</Text>
        </View>
      ) : null}

      <View className="mt-5">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">History</Text>
        <View className="gap-2">
          {records.map((r) => (
            <View key={r.id} className="flex-row items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
              <Text className="flex-1 text-sm text-gray-600">
                {r.systolic && r.diastolic ? `BP ${r.systolic}/${r.diastolic} · ` : ""}
                {r.blood_glucose != null ? `Glucose ${r.blood_glucose} · ` : ""}
                {r.spo2 != null ? `SpO2 ${r.spo2}%` : ""}
                {!r.systolic && r.blood_glucose == null && r.spo2 == null ? "Record" : ""}
              </Text>
              <Text className="text-xs text-gray-400">{formatLocalDateTime(r.recorded_at)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
