import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Lock } from "lucide-react-native";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { FormInput, PrimaryButton, ErrorBanner } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@vagewell/shared";
import type { AuthScreenProps } from "@/navigation/types";

// Admin Portal entry — same Supabase phone+OTP; role decides the shell after verify.
export function AdminLoginScreen({ navigation }: AuthScreenProps<"AdminLogin">) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setErr(null);
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setErr("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) {
      const m = error.message?.toLowerCase() ?? "";
      setErr(
        m.includes("signup") || m.includes("not allowed") || m.includes("exist") || m.includes("not found")
          ? "No account found for this number."
          : error.message
      );
      return;
    }
    navigation.navigate("AdminOTP", { e164: normalized });
  };

  return (
    <AdminScreen title="Admin portal" icon={Lock} dark onBack={() => navigation.navigate("Landing")}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
          <Text className="mb-5 text-sm text-gray-600">
            Manage appointments, verify payments, edit patient records, and export data. Same phone + OTP as
            patients — your account's role decides what you see next.
          </Text>
          <View className="gap-4 rounded-2xl border border-gray-100 bg-white p-6">
            {err ? <ErrorBanner message={err} /> : null}
            <FormInput
              label="Mobile number"
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              required
            />
            <PrimaryButton fullWidth loading={busy} onPress={send}>
              Send OTP
            </PrimaryButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AdminScreen>
  );
}
