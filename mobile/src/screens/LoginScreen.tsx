import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { ArrowLeft } from "lucide-react-native";
import { BrandLogo, FormInput, OtpInput, PrimaryButton, TextButton, ErrorBanner } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useResendTimer } from "@/hooks/useResendTimer";
import { normalizePhone, OTP_LENGTH } from "@vagewell/shared";
import type { AuthScreenProps } from "@/navigation/types";

// SCREEN_ID: LOGIN
export function LoginScreen({ navigation }: AuthScreenProps<"Login">) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [e164, setE164] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const resend = useResendTimer(60);

  // Existing-user only: shouldCreateUser:false makes Supabase reject an unknown
  // number instead of silently minting an empty patient account.
  const requestCode = async (phone: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
    if (error) {
      const m = error.message?.toLowerCase() ?? "";
      if (m.includes("signup") || m.includes("not allowed") || m.includes("not found") || m.includes("exist")) {
        setErr("No account found for this number. Please register first.");
      } else {
        setErr(error.message);
      }
      return false;
    }
    resend.restart();
    return true;
  };

  const sendOtp = async () => {
    setErr(null);
    const normalized = normalizePhone(phoneRaw);
    if (!normalized) {
      setErr("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    const ok = await requestCode(normalized);
    setBusy(false);
    if (!ok) return;
    setE164(normalized);
    setStep("otp");
    toast.success(`Verification code sent to ${normalized}`);
  };

  const resendCode = async () => {
    setErr(null);
    setOtp("");
    const ok = await requestCode(e164);
    if (ok) toast.success("Code re-sent");
  };

  const verify = async () => {
    setErr(null);
    if (otp.length !== OTP_LENGTH) {
      setErr(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // No manual navigation — RootNavigator swaps to the app stack on session change.
    toast.success("Signed in");
  };

  return (
    <SafeAreaView className="flex-1 bg-authbg">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-8" keyboardShouldPersistTaps="handled">
          <View className="mb-6 items-center">
            <View className="mb-3">
              <BrandLogo size={56} />
            </View>
            <Text className="text-2xl font-bold text-gray-900">Welcome back</Text>
            <Text className="mt-1 text-center text-sm text-gray-600">
              Together, We Move Towards Better Health.
            </Text>
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
                  label="Mobile Number"
                  value={phoneRaw}
                  onChangeText={setPhoneRaw}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  required
                />
                <PrimaryButton fullWidth loading={busy} onPress={sendOtp}>
                  Send OTP
                </PrimaryButton>
              </View>
            ) : (
              <View className="gap-4">
                <Text className="text-sm text-gray-600">
                  Enter the {OTP_LENGTH}-digit code sent to <Text className="font-semibold">{e164}</Text>.
                </Text>
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
                    Change number
                  </TextButton>
                  {resend.canResend ? (
                    <TextButton onPress={resendCode}>Resend OTP</TextButton>
                  ) : (
                    <Text className="text-xs text-gray-500">Resend in {resend.secondsLeft}s</Text>
                  )}
                </View>
                <PrimaryButton fullWidth loading={busy} onPress={verify}>
                  Verify & Continue
                </PrimaryButton>
              </View>
            )}
          </View>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-sm text-gray-600">New to VAgeWell? </Text>
            <Pressable onPress={() => navigation.navigate("Register")}>
              <Text className="text-sm font-semibold text-purple-700">Create an account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
