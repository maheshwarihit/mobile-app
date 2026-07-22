import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { toast } from "sonner-native";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { OtpInput, PrimaryButton, TextButton, ErrorBanner } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useResendTimer } from "@/hooks/useResendTimer";
import { OTP_LENGTH } from "@vagewell/shared";
import type { AuthScreenProps } from "@/navigation/types";

export function AdminOtpScreen({ navigation, route }: AuthScreenProps<"AdminOTP">) {
  const { e164 } = route.params;
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const resend = useResendTimer(60);

  const resendCode = async () => {
    setErr(null);
    setOtp("");
    const { error } = await supabase.auth.signInWithOtp({ phone: e164, options: { shouldCreateUser: false } });
    if (error) setErr(error.message);
    else {
      resend.restart();
      toast.success("Code re-sent");
    }
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
    // RootNavigator swaps to the admin shell (role-gated) on session change.
    toast.success("Signed in");
  };

  return (
    <AdminScreen title="Verify" dark onBack={() => navigation.goBack()}>
      <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
        <View className="gap-4 rounded-2xl border border-gray-100 bg-white p-6">
          <Text className="text-sm text-gray-600">
            Enter the {OTP_LENGTH}-digit code sent to <Text className="font-semibold">{e164}</Text>.
          </Text>
          {err ? <ErrorBanner message={err} /> : null}
          <OtpInput value={otp} onChange={setOtp} autoFocus />
          <View className="min-h-[16px] items-center">
            {resend.canResend ? (
              <TextButton onPress={resendCode}>Resend OTP</TextButton>
            ) : (
              <Text className="text-xs text-gray-500">Resend OTP in {resend.secondsLeft}s</Text>
            )}
          </View>
          <PrimaryButton fullWidth loading={busy} onPress={verify}>
            Verify & Continue
          </PrimaryButton>
        </View>
      </ScrollView>
    </AdminScreen>
  );
}
