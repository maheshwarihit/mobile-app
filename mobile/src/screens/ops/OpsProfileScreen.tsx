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

/**
 * SCREEN_ID: OPS_PROFILE — the signed-in caregiver/admin's own account.
 * Deliberately not the client ProfileScreen: an ops account has no health
 * record, no dependents and no bookings of its own to manage here — it needs
 * its name/employee ID/photo and a way out. Role is read-only (promotion runs
 * through the Team tab / set_user_role, never self-service) and so is the phone
 * number, which is the auth identifier itself.
 */
export function OpsProfileScreen() {
  const { profile, user, role, refreshProfile, signOut } = useAuth();
  const update = useUpdateProfile();
  const uploadPhoto = useUploadProfilePhoto();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [empId, setEmpId] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const startEdit = () => {
    setFullName(profile?.full_name ?? "");
    setEmpId(profile?.emp_id ?? "");
    setAddress(profile?.address ?? "");
    setErrors({});
    setEditing(true);
  };

  const save = () => {
    if (!profile) return;
    if (fullName.trim().length < 2) {
      setErrors({ full_name: "Enter your full name" });
      return;
    }
    setErrors({});
    update.mutate(
      {
        id: profile.id,
        full_name: fullName.trim(),
        // Untouched by this form, but useUpdateProfile takes the whole bio —
        // pass the current values through so saving a name can't blank them.
        age: profile.age,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        address: address.trim() || null,
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
        toast.error("Please upload a PNG, JPG, or WEBP image.");
        return;
      }
      if (img.fileSize > MAX_UPLOAD_BYTES) {
        toast.error("File exceeds the 5 MB limit.");
        return;
      }
      uploadPhoto.mutate(
        { userId: user.id, source: assetToProofSource(img) },
        { onSuccess: () => void refreshProfile() }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the image picker.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <PageHeader title="My profile" subtitle={role ? ROLE_LABELS[role] : undefined} />

        <SectionCard
          icon={User}
          title="Your details"
          subtitle={editing ? undefined : "Tap Edit to update your name or employee ID."}
        >
          <View className="mb-5 flex-row items-center gap-4">
            <Pressable onPress={pickPhoto} disabled={uploadPhoto.isPending} className="active:opacity-80">
              {profile ? <ProfilePhoto profile={profile} size={64} /> : null}
              <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white">
                {uploadPhoto.isPending ? <Spinner /> : <Camera size={14} color="#4b5563" />}
              </View>
            </Pressable>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">{profile?.full_name ?? "—"}</Text>
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
                label="Full name"
                value={fullName}
                onChangeText={setFullName}
                error={errors.full_name}
                autoCapitalize="words"
                required
              />
              <FormInput label="Employee ID" value={empId} onChangeText={setEmpId} placeholder="Optional" />
              <FormInput label="Address" value={address} onChangeText={setAddress} placeholder="Optional" />
              <View className="flex-row justify-end gap-3">
                <OutlineButton onPress={() => setEditing(false)}>Cancel</OutlineButton>
                <PrimaryButton loading={update.isPending} onPress={save}>
                  Save
                </PrimaryButton>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <Row label="Mobile" value={localPhone(profile?.phone) || "—"} />
              <Row label="Employee ID" value={profile?.emp_id || "—"} />
              <Row label="Address" value={profile?.address || "—"} />
              <Row label="Joined" value={profile ? formatDate(profile.created_at) : "—"} />
              <View className="mt-1 flex-row justify-end">
                <SmallPrimaryButton onPress={startEdit}>Edit details</SmallPrimaryButton>
              </View>
            </View>
          )}
        </SectionCard>

        <SectionCard icon={LogOut} title="Session">
          <Text className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Signing out ends this session on this device. You'll need a new OTP to sign back in.
          </Text>
          <DangerButton fullWidth onPress={() => setConfirmSignOut(true)}>
            Sign out
          </DangerButton>
        </SectionCard>
      </ScrollView>

      <ConfirmModal
        open={confirmSignOut}
        title="Sign out?"
        onClose={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
        confirmLabel="Sign out"
        confirmDanger
      >
        <Text className="text-sm text-gray-600">You'll be returned to the welcome screen.</Text>
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
