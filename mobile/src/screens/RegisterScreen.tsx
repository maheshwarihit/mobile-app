import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { ArrowLeft, HeartPulse } from "lucide-react-native";
import { FormInput, SelectSheet, TextareaInput, PrimaryButton, TextButton, ErrorBanner } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  normalizePhone,
  registerSchema,
  HOW_HEARD_OPTIONS,
  HOW_HEARD_LABELS,
  HOW_HEARD_DEFAULT,
  OTP_LENGTH,
} from "@vagewell/shared";
import type { AuthScreenProps } from "@/navigation/types";

const HOW_HEARD_SELECT = HOW_HEARD_OPTIONS.map((v) => ({ value: v, label: HOW_HEARD_LABELS[v] }));

// SCREEN_ID: REGISTER
export function RegisterScreen({ navigation }: AuthScreenProps<"Register">) {
  const [step, setStep] = useState<"details" | "otp">("details");
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    age: "",
    how_heard: HOW_HEARD_DEFAULT as string,
    wellness_note: "",
  });
  const [e164, setE164] = useState("");
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submitDetails = async () => {
    setErrors({});
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    const normalized = normalizePhone(form.phone)!;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: {
        data: {
          full_name: parsed.data.full_name,
          age: parsed.data.age ?? "",
          how_heard: parsed.data.how_heard,
          wellness_note: parsed.data.wellness_note ?? "",
        },
      },
    });
    setBusy(false);
    if (error) {
      setErrors({ phone: error.message });
      return;
    }
    setE164(normalized);
    setStep("otp");
    toast.success(`Verification code sent to ${normalized}`);
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
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-purple-600">
              <HeartPulse size={24} color="#fff" />
            </View>
            <Text className="text-2xl font-bold text-gray-900">Create your account</Text>
            <Text className="mt-1 text-center text-sm text-gray-600">
              A verification code will confirm your number.
            </Text>
          </View>

          <View className="rounded-2xl border border-gray-100 bg-white p-6">
            {step === "details" ? (
              <View className="gap-4">
                <FormInput
                  label="Full Name"
                  value={form.full_name}
                  onChangeText={set("full_name")}
                  placeholder="e.g. Anitha Kumar"
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
                  label="Age (optional)"
                  value={form.age}
                  onChangeText={set("age")}
                  placeholder="Age"
                  keyboardType="number-pad"
                  error={errors.age}
                />
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
                <FormInput
                  label="Verification Code"
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  required
                />
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
