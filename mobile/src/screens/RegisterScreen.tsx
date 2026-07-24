import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { ArrowLeft } from "lucide-react-native";
import {
  BrandLogo,
  FormInput,
  SelectSheet,
  TextareaInput,
  ChoiceChips,
  OtpInput,
  PrimaryButton,
  TextButton,
  ErrorBanner,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useResendTimer } from "@/hooks/useResendTimer";
import {
  normalizePhone,
  registerSchema,
  HOW_HEARD_OPTIONS,
  HOW_HEARD_LABELS,
  HOW_HEARD_DEFAULT,
  GENDERS,
  GENDER_LABELS,
  OTP_LENGTH,
} from "@vagewell/shared";
import type { AuthScreenProps } from "@/navigation/types";

const HOW_HEARD_SELECT = HOW_HEARD_OPTIONS.map((v) => ({ value: v, label: HOW_HEARD_LABELS[v] }));
const GENDER_OPTIONS = GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }));

// SCREEN_ID: REGISTER
export function RegisterScreen({ navigation }: AuthScreenProps<"Register">) {
  const [step, setStep] = useState<"details" | "otp">("details");
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    age: "",
    gender: "male",
    how_heard: HOW_HEARD_DEFAULT as string,
    wellness_note: "",
  });
  const [e164, setE164] = useState("");
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const resend = useResendTimer(60);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const sendCode = async (): Promise<boolean> => {
    const normalized = normalizePhone(form.phone)!;
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: {
        data: {
          full_name: form.full_name.trim(),
          age: form.age || "",
          gender: form.gender || "",
          how_heard: form.how_heard,
          wellness_note: form.wellness_note || "",
        },
      },
    });
    if (error) {
      setErrors({ phone: error.message });
      return false;
    }
    setE164(normalized);
    resend.restart();
    return true;
  };

  const submitDetails = async () => {
    setErrors({});
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    setBusy(true);
    const ok = await sendCode();
    setBusy(false);
    if (!ok) return;
    setStep("otp");
    toast.success(`Verification code sent to ${normalizePhone(form.phone)}`);
  };

  const resendCode = async () => {
    setErrors({});
    setOtp("");
    const ok = await sendCode();
    if (ok) toast.success("Code re-sent");
  };

  const verify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setErrors({ otp: `Enter the ${OTP_LENGTH}-digit code.` });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
    if (error) {
      setBusy(false);
      setErrors({ otp: error.message });
      return;
    }
    // Backfill the profile row (the signup trigger also reads the metadata above).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const parsed = registerSchema.safeParse(form);
      if (parsed.success) {
        await supabase
          .from("profiles")
          .update({
            full_name: parsed.data.full_name,
            age: parsed.data.age,
            gender: parsed.data.gender || null,
            how_heard: parsed.data.how_heard,
            wellness_note: parsed.data.wellness_note || null,
          })
          .eq("id", user.id);
      }
    }
    setBusy(false);
    toast.success("Account created — welcome to VAgeWell!");
    // RootNavigator swaps to the app stack on session change.
  };

  return (
    <SafeAreaView className="flex-1 bg-authbg">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-8" keyboardShouldPersistTaps="handled">
          <View className="mb-6 items-center">
            <View className="mb-3">
              <BrandLogo size={56} />
            </View>
            <Text className="text-2xl font-bold text-gray-900">Create your account</Text>
            <Text className="mt-1 text-center text-sm text-gray-600">Your Care Journey Starts Here</Text>
          </View>

          <View className="rounded-2xl border border-gray-100 bg-white p-6">
            {step === "details" ? (
              <View className="gap-4">
                <FormInput
                  label="Full Name"
                  value={form.full_name}
                  onChangeText={set("full_name")}
                  placeholder="Name"
                  error={errors.full_name}
                  autoCapitalize="words"
                  required
                />
                <FormInput
                  label="Mobile Number"
                  value={form.phone}
                  onChangeText={set("phone")}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  error={errors.phone}
                  required
                />
                <FormInput
                  label="Age"
                  value={form.age}
                  onChangeText={set("age")}
                  placeholder="Age"
                  keyboardType="number-pad"
                  error={errors.age}
                />
                <ChoiceChips label="Gender" value={form.gender} onChange={set("gender")} options={GENDER_OPTIONS} />
                <SelectSheet
                  label="How do you know about VAgeWell?"
                  value={form.how_heard}
                  onValueChange={set("how_heard")}
                  options={HOW_HEARD_SELECT}
                />
                <TextareaInput
                  label="How well are you? (optional)"
                  value={form.wellness_note}
                  onChangeText={set("wellness_note")}
                  placeholder="Briefly describe how you're feeling…"
                  rows={3}
                  maxLength={1000}
                />
                <PrimaryButton fullWidth loading={busy} onPress={submitDetails}>
                  Send OTP
                </PrimaryButton>
              </View>
            ) : (
              <View className="gap-4">
                <Text className="text-sm text-gray-600">
                  Enter the {OTP_LENGTH}-digit code sent to <Text className="font-semibold">{e164}</Text>.
                </Text>
                {errors.otp ? <ErrorBanner message={errors.otp} /> : null}
                <OtpInput value={otp} onChange={setOtp} autoFocus />
                <View className="min-h-[16px] items-center">
                  {resend.canResend ? (
                    <TextButton onPress={resendCode}>Resend OTP</TextButton>
                  ) : (
                    <Text className="text-xs text-gray-500">Resend OTP in {resend.secondsLeft}s</Text>
                  )}
                </View>
                <PrimaryButton fullWidth loading={busy} onPress={verify}>
                  Verify & Create Account
                </PrimaryButton>
                <TextButton
                  icon={ArrowLeft}
                  onPress={() => {
                    setStep("details");
                    setOtp("");
                    setErrors({});
                  }}
                >
                  Back to details
                </TextButton>
              </View>
            )}
          </View>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-sm text-gray-600">Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate("Login")}>
              <Text className="text-sm font-semibold text-purple-700">Log in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
