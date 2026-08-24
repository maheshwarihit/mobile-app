import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { User, Camera, LogOut } from "lucide-react-native";
import {
  useUpdateProfile,
  useUploadProfilePhoto,
  localPhone,
  formatDate,
  ROLE_LABELS,
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
} from "@vagewell/shared";
import {
  PageHeader,
  SectionCard,
  Pill,
  FormInput,
  PrimaryButton,
  OutlineButton,
  DangerButton,
  SmallPrimaryButton,
  ConfirmModal,
  Spinner,
} from "@/components/ui";
import { ProfilePhoto } from "@/components/ops/ProfilePhoto";
import { useAuth } from "@/providers/AuthProvider";
import { pickImageAsset, assetToProofSource } from "@/lib/upload";
import { translateTamilToEnglish } from "@/lib/translateText";
import { useLanguage } from "@/lib/i18n";

/**
 * SCREEN_ID: OPS_PROFILE — the signed-in caregiver/admin's own account.
 * Deliberately not the client ProfileScreen: an ops account has no health
 * record, no dependents and no bookings of its own to manage here — it needs
 * its name/employee ID/photo and a way out. Role is read-only (promotion runs
 * through the Team tab / set_user_role, never self-service) and so is the phone
 * number, which is the auth identifier itself.
 */
export function OpsProfileScreen() {
  const { t } = useLanguage();
  const { profile, user, role, refreshProfile, signOut } = useAuth();
  const update = useUpdateProfile();
  const uploadPhoto = useUploadProfilePhoto();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [empId, setEmpId] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setFullName(profile?.full_name ?? "");
    setDisplayName(profile?.display_name ?? "");
    setEmpId(profile?.emp_id ?? "");
    setAddress(profile?.address ?? "");
    setErrors({});
    setEditing(true);
  };

  const save = async () => {
    if (!profile) return;
    if (fullName.trim().length < 2) {
      setErrors({ full_name: t("ops.profile.error.enterName") });
      return;
    }
    setErrors({});
    setSaving(true);
    const [translatedName, translatedDisplayName, translatedAddress] = await Promise.all([
      translateTamilToEnglish(fullName.trim()),
      displayName.trim() ? translateTamilToEnglish(displayName.trim()) : Promise.resolve(""),
      address.trim() ? translateTamilToEnglish(address.trim()) : Promise.resolve(""),
    ]);
    setSaving(false);
    update.mutate(
      {
        id: profile.id,
        full_name: translatedName,
        display_name: translatedDisplayName || null,
        // Untouched by this form, but useUpdateProfile takes the whole bio —
        // pass the current values through so saving a name can't blank them.
        age: profile.age,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        address: translatedAddress || null,
        emp_id: empId.trim() || null,
      },
      {
        onSuccess: () => {
          setEditing(false);
          void refreshProfile();
        },
      }
    );
  };

  const pickPhoto = async () => {
    if (!user) return;
    try {
      const img = await pickImageAsset();
      if (!img) return;
      if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(img.mimeType)) {
        toast.error(t("ops.profile.error.imageType"));
        return;
      }
      if (img.fileSize > MAX_UPLOAD_BYTES) {
        toast.error(t("ops.profile.error.fileSize"));
        return;
      }
      uploadPhoto.mutate(
        { userId: user.id, source: assetToProofSource(img) },
        { onSuccess: () => void refreshProfile() }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("ops.profile.error.pickerFailed"));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <PageHeader title={t("ops.profile.title")} subtitle={role ? ROLE_LABELS[role] : undefined} />

        <SectionCard
          icon={User}
          title={t("ops.profile.detailsTitle")}
          subtitle={editing ? undefined : t("ops.profile.detailsHint")}
        >
          <View className="mb-5 flex-row items-center gap-4">
            <Pressable onPress={pickPhoto} disabled={uploadPhoto.isPending} className="active:opacity-80">
              {profile ? <ProfilePhoto profile={profile} size={64} /> : null}
              <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white">
                {uploadPhoto.isPending ? <Spinner /> : <Camera size={14} color="#4b5563" />}
              </View>
            </Pressable>
            <View className="flex-1">
              {/* display_name (the real name collected at sign-up, see AuthModal.tsx)
                  instead of full_name — every ops account of a given role shares the
                  same fixed full_name (the self-select-role gate string), which would
                  otherwise show back to the account as its own "name" here. */}
              <Text className="text-lg font-bold text-gray-900 dark:text-white">{profile?.display_name ?? profile?.full_name ?? "—"}</Text>
              <View className="mt-1 flex-row">
                <Pill bgClass="bg-purple-50 dark:bg-purple-400/10" textClass="text-purple-700 dark:text-purple-300">
                  {role ? ROLE_LABELS[role] : "—"}
                </Pill>
              </View>
            </View>
          </View>

          {editing ? (
            <View className="gap-4">
              <FormInput
                label={t("ops.profile.fullName")}
                value={fullName}
                onChangeText={setFullName}
                error={errors.full_name}
                autoCapitalize="words"
                required
              />
              <FormInput label={t("ops.profile.yourName")} value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
              <FormInput label={t("ops.profile.employeeId")} value={empId} onChangeText={setEmpId} placeholder={t("ops.profile.employeeIdPlaceholder")} />
              <FormInput label={t("ops.profile.address")} value={address} onChangeText={setAddress} placeholder={t("ops.profile.addressPlaceholder")} />
              <View className="flex-row justify-end gap-3">
                <OutlineButton onPress={() => setEditing(false)}>{t("ops.cancel")}</OutlineButton>
                <PrimaryButton loading={saving || update.isPending} onPress={save}>
                  {t("ops.save")}
                </PrimaryButton>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <Row label={t("ops.profile.yourName")} value={profile?.display_name ?? profile?.full_name ?? "—"} />
              <Row label={t("ops.profile.mobile")} value={localPhone(profile?.phone) || "—"} />
              <Row label={t("ops.profile.employeeId")} value={profile?.emp_id || "—"} />
              <Row label={t("ops.profile.address")} value={profile?.address || "—"} />
              <Row label={t("ops.profile.joined")} value={profile ? formatDate(profile.created_at) : "—"} />
              <View className="mt-1 flex-row justify-end">
                <SmallPrimaryButton onPress={startEdit}>{t("ops.profile.editDetails")}</SmallPrimaryButton>
              </View>
            </View>
          )}
        </SectionCard>

        <SectionCard icon={LogOut} title={t("ops.profile.sessionTitle")}>
          <Text className="mb-4 text-sm text-gray-500 dark:text-gray-400">{t("ops.profile.sessionHint")}</Text>
          <DangerButton fullWidth onPress={() => setConfirmSignOut(true)}>
            {t("ops.profile.signOut")}
          </DangerButton>
        </SectionCard>
      </ScrollView>

      <ConfirmModal
        open={confirmSignOut}
        title={t("ops.profile.confirmSignOut.title")}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
        confirmLabel={t("ops.profile.signOut")}
        confirmDanger
      >
        <Text className="text-sm text-gray-600">{t("ops.profile.confirmSignOut.body")}</Text>
      </ConfirmModal>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-gray-900 dark:text-white">{value}</Text>
    </View>
  );
}
