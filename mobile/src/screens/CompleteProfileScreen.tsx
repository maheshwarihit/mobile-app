import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { BrandLogo, FormInput, ChoiceChips, TextareaInput, PrimaryButton, OutlineButton } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";
import { genderLabel } from "@/lib/enumI18n";
import { translateTamilToEnglish } from "@/lib/translateText";
import { useUpdateProfile } from "@vagewell/shared";
import { GENDERS } from "@vagewell/shared";

/**
 * One-time gate for an admin/leaf_node account using the mobile app for
 * the first time — their profile was created via the web portal's Register
 * page, which only ever collects Full Name + Mobile Number, so age/gender/
 * address are all still null. RootNavigator renders this instead of the
 * normal tabs until all three are filled in; saving flips the gate closed
 * for good (an ordinary patient signup already has these from the mobile
 * Register screen, so this never shows for them).
 */
export function CompleteProfileScreen() {
  const { t } = useLanguage();
  const GENDER_OPTIONS = GENDERS.map((g) => ({ value: g, label: genderLabel(t, g) }));
  const { profile, refreshProfile, signOut } = useAuth();
  const update = useUpdateProfile();
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErrors({});
    if (!address.trim()) {
      setErrors({ address: t("completeProfile.error.enterAddress") });
      return;
    }
    const ageNum = age.trim() === "" ? null : Number(age);
    if (age.trim() !== "" && (isNaN(ageNum as number) || (ageNum as number) < 0 || (ageNum as number) > 150)) {
      setErrors({ age: t("completeProfile.error.invalidAge") });
      return;
    }
    if (!profile) return;
    setSaving(true);
    const translatedAddress = await translateTamilToEnglish(address.trim());
    setSaving(false);
    update.mutate(
      {
        id: profile.id,
        full_name: profile.full_name ?? "",
        age: ageNum,
        date_of_birth: profile.date_of_birth ?? null,
        gender,
        address: translatedAddress,
      },
      {
        onSuccess: async () => {
          toast.success(t("completeProfile.toast.success"));
          await refreshProfile();
        },
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-authbg">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-8" keyboardShouldPersistTaps="handled">
          <View className="mb-6 items-center">
            <View className="mb-3">
              <BrandLogo size={56} />
            </View>
            <Text className="text-2xl font-bold text-gray-900">{t("completeProfile.title")}</Text>
            <Text className="mt-1 text-center text-sm text-gray-600">{t("completeProfile.subtitle")}</Text>
          </View>

          <View className="rounded-2xl border border-gray-100 bg-white p-6">
            <View className="gap-4">
              <FormInput
                label={t("completeProfile.age")}
                value={age}
                onChangeText={setAge}
                placeholder={t("completeProfile.age")}
                keyboardType="number-pad"
                error={errors.age}
              />
              <ChoiceChips label={t("completeProfile.gender")} value={gender} onChange={setGender} options={GENDER_OPTIONS} />
              <TextareaInput
                label={t("completeProfile.address")}
                value={address}
                onChangeText={setAddress}
                placeholder={t("completeProfile.addressPlaceholder")}
                rows={2}
                maxLength={500}
                error={errors.address}
              />
              <PrimaryButton fullWidth loading={saving || update.isPending} onPress={save}>
                {t("completeProfile.saveAndContinue")}
              </PrimaryButton>
              <OutlineButton fullWidth onPress={signOut}>
                {t("completeProfile.signOut")}
              </OutlineButton>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
