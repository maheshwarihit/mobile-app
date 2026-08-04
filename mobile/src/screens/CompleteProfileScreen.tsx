import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { BrandLogo, FormInput, ChoiceChips, TextareaInput, PrimaryButton, OutlineButton } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useUpdateProfile } from "@vagewell/shared";
import { GENDERS, GENDER_LABELS } from "@vagewell/shared";

const GENDER_OPTIONS = GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }));

/**
 * One-time gate for a staff/admin/leaf_node account using the mobile app for
 * the first time — their profile was created via the web portal's Register
 * page, which only ever collects Full Name + Mobile Number, so age/gender/
 * address are all still null. RootNavigator renders this instead of the
 * normal tabs until all three are filled in; saving flips the gate closed
 * for good (an ordinary patient signup already has these from the mobile
 * Register screen, so this never shows for them).
 */
export function CompleteProfileScreen() {
  const { profile, signOut } = useAuth();
  const update = useUpdateProfile();
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    setErrors({});
    if (!address.trim()) {
      setErrors({ address: "Enter your address." });
      return;
    }
    const ageNum = age.trim() === "" ? null : Number(age);
    if (age.trim() !== "" && (isNaN(ageNum as number) || (ageNum as number) < 0 || (ageNum as number) > 150)) {
      setErrors({ age: "Enter a valid age." });
      return;
    }
    if (!profile) return;
    update.mutate(
      {
        id: profile.id,
        full_name: profile.full_name ?? "",
        age: ageNum,
        date_of_birth: profile.date_of_birth ?? null,
        gender,
        address: address.trim(),
      },
      { onSuccess: () => toast.success("All set — welcome to VAgeWell!") }
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
            <Text className="text-2xl font-bold text-gray-900">Complete your profile</Text>
            <Text className="mt-1 text-center text-sm text-gray-600">
              Your staff account never collected these — fill them in once to use VAgeWell as a patient too.
            </Text>
          </View>

          <View className="rounded-2xl border border-gray-100 bg-white p-6">
            <View className="gap-4">
              <FormInput
                label="Age"
                value={age}
                onChangeText={setAge}
                placeholder="Age"
                keyboardType="number-pad"
                error={errors.age}
              />
              <ChoiceChips label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} />
              <TextareaInput
                label="Address"
                value={address}
                onChangeText={setAddress}
                placeholder="House/street, city, pincode…"
                rows={2}
                maxLength={500}
                error={errors.address}
              />
              <PrimaryButton fullWidth loading={update.isPending} onPress={save}>
                Save & Continue
              </PrimaryButton>
              <OutlineButton fullWidth onPress={signOut}>
                Sign out
              </OutlineButton>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
