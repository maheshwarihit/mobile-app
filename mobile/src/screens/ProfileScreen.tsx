import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking, Platform, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useFocusEffect } from "@react-navigation/native";
import { toast } from "sonner-native";
import { UserCircle, Users, Activity, ClipboardList, Pencil, Trash2, Plus, Lock, LogOut, FileText, Download, Camera } from "lucide-react-native";
import {
  PageHeader,
  SectionCard,
  SelectSheet,
  FormInput,
  TextareaInput,
  DateField,
  ChoiceChips,
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
import { pickImageAsset, assetToProofSource } from "@/lib/upload";
import { translateServiceName } from "@/lib/serviceI18n";
import { genderLabel, relationshipLabel } from "@/lib/enumI18n";
import { translateTamilToEnglish } from "@/lib/translateText";
import { useLanguage, type Language } from "@/lib/i18n";
import { BRAND } from "@/theme";
import {
  useFamilyMembers,
  useClinicalRecords,
  useDeleteDependent,
  useMyReports,
  useMyBookings,
  useUpdateProfile,
  useUploadProfilePhoto,
  formatDate,
  formatLocalDateTime,
  formatLocalTime,
  groupByLocalDate,
  localPhone,
  profileSchema,
  GENDERS,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  PROFILE_PHOTO_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  isBookingTerminal,
  isBookingMissed,
  bookingStatusMeta,
  type FamilyMember,
  type ClinicalRecord,
  type ReportUpload,
  type Booking,
} from "@vagewell/shared";

// SCREEN_ID: PROFILE
export function ProfileScreen() {
  const { t, language, setLanguage } = useLanguage();
  const GENDER_OPTIONS = GENDERS.map((g) => ({ value: g, label: genderLabel(t, g) }));
  const { profile, user, loading, signOut, refreshProfile } = useAuth();
  const { data: dependents, isLoading: depsLoading } = useFamilyMembers();
  const del = useDeleteDependent();
  const updateProfile = useUpdateProfile();
  const uploadPhoto = useUploadProfilePhoto();
  const [savingBio, setSavingBio] = useState(false);

  const [depModalOpen, setDepModalOpen] = useState(false);
  const [editingDep, setEditingDep] = useState<FamilyMember | null>(null);
  const [deleteDep, setDeleteDep] = useState<FamilyMember | null>(null);

  const [editingBio, setEditingBio] = useState(false);
  const [bioForm, setBioForm] = useState({ full_name: "", age: "", date_of_birth: "", gender: "male", address: "" });
  const [bioErrors, setBioErrors] = useState<Record<string, string>>({});
  const setBio = (k: keyof typeof bioForm) => (v: string) => setBioForm((f) => ({ ...f, [k]: v }));

  const startEditBio = () => {
    setBioForm({
      full_name: profile?.full_name ?? "",
      age: profile?.age?.toString() ?? "",
      date_of_birth: profile?.date_of_birth ?? "",
      gender: profile?.gender ?? "male",
      address: profile?.address ?? "",
    });
    setBioErrors({});
    setEditingBio(true);
  };

  const saveBio = async () => {
    setBioErrors({});
    const parsed = profileSchema.safeParse(bioForm);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setBioErrors(errs);
      return;
    }
    if (!profile) return;
    // Free-text fields are stored in English regardless of what script the
    // person typed in — a best-effort auto-translate (see translateText.ts),
    // not applied to Gender/Date of birth, which already store a fixed
    // English code/ISO date no matter the UI language.
    setSavingBio(true);
    const [full_name, address] = await Promise.all([
      translateTamilToEnglish(parsed.data.full_name),
      parsed.data.address ? translateTamilToEnglish(parsed.data.address) : Promise.resolve(parsed.data.address),
    ]);
    setSavingBio(false);
    updateProfile.mutate(
      {
        id: profile.id,
        full_name,
        age: parsed.data.age,
        date_of_birth: parsed.data.date_of_birth || null,
        gender: parsed.data.gender || null,
        address: address || null,
      },
      {
        onSuccess: async () => {
          setEditingBio(false);
          await refreshProfile();
        },
      }
    );
  };

  const avatarUrl = profile?.avatar_path
    ? `${supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(profile.avatar_path).data.publicUrl}?v=${encodeURIComponent(profile.updated_at)}`
    : null;

  const pickPhoto = async () => {
    if (!user) return;
    try {
      const img = await pickImageAsset();
      if (!img) return;
      if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(img.mimeType)) {
        toast.error(t("profile.error.imageType"));
        return;
      }
      if (img.fileSize > MAX_UPLOAD_BYTES) {
        toast.error(t("profile.error.fileSize"));
        return;
      }
      uploadPhoto.mutate({ userId: user.id, source: assetToProofSource(img) }, { onSuccess: () => refreshProfile() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("profile.error.pickerFailed"));
    }
  };

  const [subject, setSubject] = useState("self");

  const subjectOptions = [
    { value: "self", label: t("appointment.myself") },
    ...(dependents ?? []).map((d) => ({ value: d.id, label: d.full_name })),
  ];
  const subjectQuery = useMemo(
    () => (subject === "self" ? { profileId: user?.id } : { familyMemberId: subject }),
    [subject, user?.id]
  );
  const { data: records, isLoading: vitalsLoading, refetch: refetchVitals } = useClinicalRecords(user ? subjectQuery : null);

  // Reports released to the customer are shown alongside vitals in the Health
  // record, scoped to whichever subject (self/dependent) is selected above —
  // reports don't carry a direct subject column, so match through their booking.
  const { data: reports, isLoading: reportsLoading, refetch: refetchReports } = useMyReports(true);
  const { data: myBookings, refetch: refetchBookings } = useMyBookings();

  // A report release (or a new vitals entry) happens on the web portal, a
  // different device entirely — that device's own query-cache invalidation
  // has no way to reach this one. Without refetching on focus, a released
  // report could sit invisible here indefinitely even though the server-side
  // state is already correct, exactly the same class of bug already fixed
  // once for the Dashboard tab's bookings.
  useFocusEffect(
    useCallback(() => {
      void refetchReports();
      void refetchBookings();
      void refetchVitals();
    }, [refetchReports, refetchBookings, refetchVitals])
  );
  const bookingsForSubject = useMemo(
    () => (myBookings ?? []).filter((b) => (subject === "self" ? !b.family_member_id : b.family_member_id === subject)),
    [myBookings, subject]
  );
  const reportsForSubject = useMemo(() => {
    const bookingMap = new Map((myBookings ?? []).map((b) => [b.id, b]));
    return (reports ?? []).filter((r) => {
      const b = bookingMap.get(r.booking_id);
      if (!b) return false;
      return subject === "self" ? !b.family_member_id : b.family_member_id === subject;
    });
  }, [reports, myBookings, subject]);

  // Checkup history — every past visit for this subject (completed, cancelled,
  // or missed), newest first. Upcoming/active bookings live on the
  // Appointments tab instead, not here.
  const checkupHistory = useMemo(
    () =>
      bookingsForSubject
        .filter((b) => isBookingTerminal(b.booking_status) || isBookingMissed(b.booking_status, b.start_date, b.time_slot))
        .sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [bookingsForSubject]
  );

  const openReport = async (r: ReportUpload) => {
    const { data, error: signErr } = await supabase.storage
      .from(MEDICAL_REPORT_BUCKET)
      .createSignedUrl(r.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !data?.signedUrl) {
      toast.error(t("profile.error.reportOpenFailed"));
      return;
    }
    Linking.openURL(data.signedUrl);
  };

  // `download: true` makes Supabase respond with Content-Disposition:
  // attachment on that signed URL specifically — distinct from openReport's
  // plain URL, which just navigates/previews instead of saving.
  const downloadReport = async (r: ReportUpload) => {
    const { data, error: signErr } = await supabase.storage
      .from(MEDICAL_REPORT_BUCKET)
      .createSignedUrl(r.storage_path, SIGNED_URL_TTL_SECONDS, { download: true });
    if (signErr || !data?.signedUrl) {
      toast.error(t("profile.error.reportDownloadFailed"));
      return;
    }
    if (Platform.OS === "web") {
      // The browser handles the attachment header itself once navigated to.
      Linking.openURL(data.signedUrl);
      return;
    }
    try {
      const fileName = r.file_name ?? `report-${r.id}.${r.storage_path.split(".").pop() ?? "pdf"}`;
      const { uri } = await FileSystem.downloadAsync(data.signedUrl, `${FileSystem.cacheDirectory}${fileName}`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        toast.error(t("profile.error.sharingUnavailable"));
      }
    } catch {
      toast.error(t("profile.error.reportDownloadFailed"));
    }
  };

  if (loading) return <LoadingState message={t("profile.loading")} />;

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pt-4 pb-10" keyboardShouldPersistTaps="handled">
        <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />

        {/* ── Bio (self-editable) ─────────────────────────── */}
        <SectionCard icon={UserCircle} title={t("profile.yourDetails")}>
          <View className="mb-4 items-center">
            <Pressable onPress={pickPhoto} disabled={uploadPhoto.isPending} className="relative h-24 w-24 active:opacity-70">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="h-24 w-24 rounded-full" resizeMode="cover" />
              ) : (
                <View className="h-24 w-24 items-center justify-center rounded-full bg-purple-50">
                  <UserCircle size={48} color={BRAND} />
                </View>
              )}
              <View className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-purple-600">
                {uploadPhoto.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={14} color="#fff" />}
              </View>
            </Pressable>
          </View>

          {editingBio ? (
            <View className="gap-4">
              <FormInput label={t("profile.fullName")} value={bioForm.full_name} onChangeText={setBio("full_name")} error={bioErrors.full_name} autoCapitalize="words" required />
              <FormInput label={t("profile.age")} value={bioForm.age} onChangeText={setBio("age")} placeholder={t("profile.row.age")} keyboardType="number-pad" error={bioErrors.age} />
              <DateField label={t("profile.dob")} value={bioForm.date_of_birth} onChange={setBio("date_of_birth")} />
              <ChoiceChips label={t("profile.gender")} value={bioForm.gender} onChange={setBio("gender")} options={GENDER_OPTIONS} />
              <TextareaInput label={t("profile.address")} value={bioForm.address} onChangeText={setBio("address")} placeholder={t("profile.addressPlaceholder")} rows={2} maxLength={500} />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <OutlineButton fullWidth onPress={() => setEditingBio(false)}>
                    {t("profile.cancel")}
                  </OutlineButton>
                </View>
                <View className="flex-1">
                  <PrimaryButton fullWidth loading={savingBio || updateProfile.isPending} onPress={saveBio}>
                    {t("profile.save")}
                  </PrimaryButton>
                </View>
              </View>
            </View>
          ) : (
            <>
              <View className="gap-2">
                <Row label={t("profile.row.name")} value={profile?.full_name ?? "—"} />
                <Row label={t("profile.row.mobile")} value={localPhone(profile?.phone) || "—"} />
                <Row label={t("profile.row.age")} value={profile?.age?.toString() ?? "—"} />
                <Row label={t("profile.row.dob")} value={profile?.date_of_birth ? formatDate(profile.date_of_birth) : "—"} />
                <Row label={t("profile.row.gender")} value={profile?.gender ? genderLabel(t, profile.gender) : "—"} />
                <Row label={t("profile.row.address")} value={profile?.address ?? "—"} />
              </View>
              <View className="mt-3">
                <OutlineButton icon={Pencil} onPress={startEditBio}>
                  {t("profile.editDetails")}
                </OutlineButton>
              </View>
            </>
          )}
        </SectionCard>

        {/* ── Language ─────────────────────────────────────── */}
        <SectionCard icon={UserCircle} title={t("profile.language.title")} subtitle={t("profile.language.subtitle")}>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <OutlineButton fullWidth onPress={() => setLanguage("en" as Language)}>
                {`${(language ?? "en") === "en" ? "✓ " : ""}${t("chooseLanguage.english")}`}
              </OutlineButton>
            </View>
            <View className="flex-1">
              <OutlineButton fullWidth onPress={() => setLanguage("ta" as Language)}>
                {`${language === "ta" ? "✓ " : ""}${t("chooseLanguage.tamil")}`}
              </OutlineButton>
            </View>
          </View>
        </SectionCard>

        {/* ── Dependents ──────────────────────────────────── */}
        <SectionCard
          icon={Users}
          title={t("profile.dependents.title")}
          subtitle={t("profile.dependents.subtitle")}
        >
          {depsLoading ? (
            <LoadingState message={t("profile.dependents.loading")} />
          ) : (dependents?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Users}
              title={t("profile.dependents.empty.title")}
              description={t("profile.dependents.empty.description")}
              actionLabel={t("profile.dependents.addAction")}
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
                        {d.linked_profile_id ? t("profile.dependents.hasLogin") : t("profile.dependents.notRegistered")}
                      </Pill>
                    </View>
                    <Text className="text-xs text-gray-500">
                      {relationshipLabel(t, d.relationship)}
                      {d.age != null ? ` · ${d.age} ${t("profile.dependents.yrs")}` : ""}
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
                {t("profile.dependents.addAction")}
              </OutlineButton>
            </View>
          ) : null}
        </SectionCard>

        {/* ── Health record (read-only) ───────────────────── */}
        <SectionCard icon={Activity} title={t("profile.healthRecord.title")} subtitle={t("profile.healthRecord.subtitle")}>
          <View className="mb-4 flex-row items-center gap-2">
            <Lock size={13} color="#9ca3af" />
            <Text className="flex-1 text-xs text-gray-400">{t("profile.healthRecord.readOnly")}</Text>
          </View>
          <View className="mb-4">
            <SelectSheet label={t("profile.healthRecord.viewRecordFor")} value={subject} onValueChange={setSubject} options={subjectOptions} />
          </View>
          {vitalsLoading ? <LoadingState message={t("profile.healthRecord.loadingVitals")} /> : <VitalsView records={records ?? []} />}

          <View className="mt-4 border-t border-gray-100 pt-4">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("profile.reports.title")}</Text>
            {reportsLoading ? (
              <LoadingState message={t("profile.reports.loading")} />
            ) : reportsForSubject.length === 0 ? (
              <Text className="text-xs text-gray-400">{t("profile.reports.empty")}</Text>
            ) : (
              <View className="gap-4">
                {groupByLocalDate(reportsForSubject).map((group) => (
                  <View key={group.dateLabel}>
                    <Text className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{group.dateLabel}</Text>
                    <View className="gap-2">
                      {group.items.map((r) => (
                        <View key={r.id} className="flex-row items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                          <Pressable onPress={() => openReport(r)} className="flex-1 flex-row items-center gap-2.5">
                            <View className="h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                              <FileText size={15} color="#7c3aed" />
                            </View>
                            <View className="flex-1">
                              <Text className="text-xs font-medium text-gray-900">{r.file_name ?? REPORT_TYPE_LABELS[r.report_type]}</Text>
                              <Text className="text-[11px] text-gray-500">
                                {REPORT_TYPE_LABELS[r.report_type]} · {formatLocalTime(r.created_at)}
                              </Text>
                            </View>
                          </Pressable>
                          <Pressable onPress={() => downloadReport(r)} hitSlop={8} className="p-1 active:opacity-60">
                            <Download size={16} color="#7c3aed" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View className="mt-4 border-t border-gray-100 pt-4">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("profile.checkupHistory.title")}</Text>
            {checkupHistory.length === 0 ? (
              <Text className="text-xs text-gray-400">{t("profile.checkupHistory.empty")}</Text>
            ) : (
              <View className="gap-2">
                {checkupHistory.map((b) => (
                  <CheckupRow key={b.id} booking={b} />
                ))}
              </View>
            )}
          </View>
        </SectionCard>

        <OutlineButton icon={LogOut} fullWidth onPress={signOut}>
          {t("profile.signOut")}
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
        title={t("profile.removeDependent.title")}
        onClose={() => setDeleteDep(null)}
        onConfirm={() => {
          if (deleteDep) del.mutate(deleteDep.id);
          setDeleteDep(null);
        }}
        confirmLabel={t("profile.removeDependent.confirm")}
        cancelLabel={t("profile.removeDependent.cancel")}
        confirmDanger
      >
        <Text className="text-sm text-gray-600">
          {t("profile.removeDependent.body", { name: deleteDep?.full_name ?? "" })}
        </Text>
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

function CheckupRow({ booking: b }: { booking: Booking }) {
  const { t } = useLanguage();
  const missed = isBookingMissed(b.booking_status, b.start_date, b.time_slot);
  const status = missed
    ? { label: t("profile.checkupHistory.missed"), bg: "bg-red-100", text: "text-red-700" }
    : bookingStatusMeta(b.booking_status);
  return (
    <View className="flex-row items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-gray-200">
        <ClipboardList size={15} color="#6b7280" />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-medium text-gray-900">{translateServiceName(t, b.service_name)}</Text>
        <Text className="text-[11px] text-gray-500">{formatDate(b.start_date)}</Text>
      </View>
      <Pill bgClass={status.bg} textClass={status.text}>
        {status.label}
      </Pill>
    </View>
  );
}

function VitalsView({ records }: { records: ClinicalRecord[] }) {
  const { t } = useLanguage();
  // Patient panel shows only Sugar (blood glucose) + Blood Group.
  // `records` is ordered recorded_at desc and each visit is saved as its own
  // dated row carrying only the fields staff filled in — so read the most recent
  // NON-NULL value per field. Taking records[0] wholesale would blank out a blood
  // group captured on an earlier visit (there is no History list to fall back on).
  const sugarRecord = records.find((r) => r.blood_glucose != null);
  const bloodGroupRecord = records.find((r) => !!r.blood_group);
  const sugar = sugarRecord?.blood_glucose ?? null;
  const bloodGroup = bloodGroupRecord?.blood_group ?? null;
  if (sugar == null && bloodGroup == null) {
    return (
      <EmptyState
        icon={Activity}
        title={t("profile.healthRecord.noRecords.title")}
        description={t("profile.healthRecord.noRecords.description")}
      />
    );
  }
  const latestDate = [sugarRecord?.recorded_at, bloodGroupRecord?.recorded_at].filter(Boolean).sort().at(-1);
  const tiles = [
    { label: t("profile.healthRecord.sugar"), value: sugar?.toString() ?? "—", unit: "mg/dL" },
    { label: t("profile.healthRecord.bloodGroup"), value: bloodGroup ?? "—", unit: "" },
  ];
  return (
    <View>
      <View className="flex-row flex-wrap gap-3">
        {tiles.map((tile) => (
          <View key={tile.label} className="min-w-[45%] flex-1 items-center rounded-xl border border-gray-100 bg-white p-3">
            <Text className="text-lg font-bold text-gray-900">{tile.value}</Text>
            <Text className="text-[10px] text-gray-400">{tile.unit}</Text>
            <Text className="mt-1 text-[11px] font-medium text-gray-500">{tile.label}</Text>
          </View>
        ))}
      </View>
      {latestDate ? (
        <Text className="mt-2 text-[11px] text-gray-400">
          {t("profile.healthRecord.asOf", { date: formatLocalDateTime(latestDate) })}
        </Text>
      ) : null}
    </View>
  );
}
