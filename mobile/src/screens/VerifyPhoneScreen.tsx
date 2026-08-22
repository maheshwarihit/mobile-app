import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { ArrowLeft } from "lucide-react-native";
import { BrandLogo, FormInput, OtpInput, PrimaryButton, OutlineButton, TextButton, ErrorBanner } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";
import { useResendTimer } from "@/hooks/useResendTimer";
import { supabase } from "@/lib/supabase";
import { normalizePhone, OTP_LENGTH, useUpdateProfile } from "@vagewell/shared";

type Step = "phone" | "otp";

/**
 * Gate for any account with no verified phone on file — today that's only
 * ever a Google sign-in (Google hands back an email identity, never a
 * phone). RootNavigator renders this instead of the normal shell until
 * `profile.phone` is set, which only ever happens via the DB trigger this
 * screen's success path triggers (migration 0031) — the client can never
 * write `profiles.phone` directly (see the profiles UPDATE grant), same as
 * at signup.
 *
 * Uses Supabase's standard phone-change flow — `auth.updateUser({ phone })`
 * sends an OTP to the new number, `auth.verifyOtp({ type: "phone_change" })`
 * confirms it — rather than the sign-up OTP flow, since this account is
 * already authenticated; it's adding a phone to itself, not creating a new
 * session.
 */
export function VerifyPhoneScreen() {
  const { t } = useLanguage();
  const { profile, refreshProfile, signOut } = useAuth();
  const updateProfile = useUpdateProfile();
  const [step, setStep] = useState<Step>("phone");
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [e164, setE164] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const resend = useResendTimer(60);

  const requestCode = async (phone: string): Promise<boolean> => {
    const { error } = await supabase.auth.updateUser({ phone });
    if (error) {
      const m = error.message?.toLowerCase() ?? "";
      setErr(m.includes("already") || m.includes("exist") ? t("verifyPhone.error.alreadyRegistered") : t("verifyPhone.error.updateFailed"));
      return false;
    }
    resend.restart();
    return true;
  };

  const sendOtp = async () => {
    setErr(null);
    if (fullName.trim().length < 2) {
      setErr(t("auth.error.enterName"));
      return;
    }
    const normalized = normalizePhone(phoneRaw);
    if (!normalized) {
      setErr(t("auth.error.invalidPhone"));
      return;
    }
    if (!profile) return;
    setBusy(true);
    // Save the (possibly Google-prefilled, possibly edited) name before the
    // phone step — independent of OTP success, since it's just a bio field
    // update and shouldn't be lost if the phone step is retried.
    if (fullName.trim() !== (profile.full_name ?? "")) {
      updateProfile.mutate({
        id: profile.id,
        full_name: fullName.trim(),
        age: profile.age,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        address: profile.address,
      });
    }
    const ok = await requestCode(normalized);
    setBusy(false);
    if (!ok) return;
    setE164(normalized);
    setStep("otp");
    toast.success(t("auth.toast.codeSent", { phone: normalized }));
  };

  const resendCode = async () => {
    setErr(null);
    setOtp("");
    const ok = await requestCode(e164);
    if (ok) toast.success(t("auth.toast.codeResent"));
  };

  const verify = async () => {
    setErr(null);
    if (otp.length !== OTP_LENGTH) {
      setErr(t("auth.error.enterCode", { length: OTP_LENGTH }));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: "phone_change" });
    if (error) {
      setBusy(false);
      setErr(t("verifyPhone.error.verifyFailed"));
      return;
    }
    // The DB trigger (0031) sets profiles.phone the instant auth.users.phone
    // changes — refetch so RootNavigator's !profile.phone gate sees it and
    // swaps to the normal shell.
    await refreshProfile();
    setBusy(false);
    toast.success(t("verifyPhone.toast.success"));
  };

  return (
    <SafeAreaView className="flex-1 bg-authbg">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-8" keyboardShouldPersistTaps="handled">
          <View className="mb-6 items-center">
            <View className="mb-3">
              <BrandLogo size={56} />
            </View>
            <Text className="text-2xl font-bold text-gray-900">{t("verifyPhone.title")}</Text>
            <Text className="mt-1 text-center text-sm text-gray-600">{t("verifyPhone.subtitle")}</Text>
          </View>

          <View className="rounded-2xl border border-gray-100 bg-white p-6">
            {err ? (
              <View className="mb-4">
                <ErrorBanner message={err} />
              </View>
            ) : null}

            {step === "phone" ? (
              <View className="gap-4">
                <FormInput
                  label={t("auth.fullName")}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t("auth.namePlaceholder")}
                  autoCapitalize="words"
                  required
                />
                <FormInput
                  label={t("auth.mobileNumber")}
                  value={phoneRaw}
                  onChangeText={setPhoneRaw}
                  placeholder={t("auth.mobilePlaceholder")}
                  keyboardType="phone-pad"
                  required
                />
                <PrimaryButton fullWidth loading={busy} onPress={sendOtp}>
                  {t("verifyPhone.sendOtp")}
                </PrimaryButton>
                <OutlineButton fullWidth onPress={signOut}>
                  {t("verifyPhone.signOut")}
                </OutlineButton>
              </View>
            ) : (
              <View className="gap-4">
                <Text className="text-sm text-gray-600">{t("auth.enterCode", { length: OTP_LENGTH, phone: e164 })}</Text>
                <OtpInput value={otp} onChange={setOtp} autoFocus />
                <View className="flex-row items-center justify-between">
                  <TextButton
                    icon={ArrowLeft}
                    onPress={() => {
                      setStep("phone");
                      setOtp("");
                      setErr(null);
                    }}
                  >
                    {t("auth.changeNumber")}
                  </TextButton>
                  {resend.canResend ? (
                    <TextButton onPress={resendCode}>{t("auth.resendOtp")}</TextButton>
                  ) : (
                    <Text className="text-xs text-gray-500">{t("auth.resendIn", { seconds: resend.secondsLeft })}</Text>
                  )}
                </View>
                <PrimaryButton fullWidth loading={busy} onPress={verify}>
                  {t("auth.verifyAndContinue")}
                </PrimaryButton>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
