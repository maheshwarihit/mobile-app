import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { toast } from "sonner-native";
import { ArrowLeft } from "lucide-react-native";
import { AppModal, FormInput, OtpInput, PrimaryButton, TextButton, ErrorBanner } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useResendTimer } from "@/hooks/useResendTimer";
import { normalizePhone, OTP_LENGTH } from "@vagewell/shared";

type Mode = "login" | "register";
type Step = "details" | "otp";

/**
 * Centered sign-in/sign-up popup shown over the Home screen. Sign-up only
 * ever collects Name + Phone here — age/gender/address/etc. are filled in
 * later from the Profile screen's edit form, not up front. No manual
 * navigation on success: RootNavigator swaps to the app shell the moment
 * the session changes.
 */
export function AuthModal({
  visible,
  onClose,
  initialMode = "register",
}: {
  visible: boolean;
  onClose: () => void;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [e164, setE164] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const resend = useResendTimer(60);

  const reset = () => {
    setStep("details");
    setFullName("");
    setPhoneRaw("");
    setE164("");
    setOtp("");
    setErr(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    reset();
  };

  const requestCode = async (phone: string): Promise<boolean> => {
    if (mode === "login") {
      // Existing-user only: shouldCreateUser:false rejects an unknown number
      // instead of silently minting an empty account.
      const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
      if (error) {
        const m = error.message?.toLowerCase() ?? "";
        if (m.includes("signup") || m.includes("not allowed") || m.includes("not found") || m.includes("exist")) {
          setErr("No account found for this number. Try Sign up instead.");
        } else {
          setErr(error.message);
        }
        return false;
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) {
        setErr(error.message);
        return false;
      }
    }
    resend.restart();
    return true;
  };

  const sendOtp = async () => {
    setErr(null);
    if (mode === "register" && fullName.trim().length < 2) {
      setErr("Enter your full name.");
      return;
    }
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
    toast.success(mode === "login" ? "Signed in" : "Account created — welcome to VAgeWell!");
    reset();
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title={mode === "login" ? "Welcome back" : "Create your account"}
    >
      <View className="mb-4 flex-row rounded-lg bg-gray-100 p-1">
        <Pressable onPress={() => switchMode("login")} className={`flex-1 items-center rounded-md py-2 ${mode === "login" ? "bg-white" : ""}`}>
          <Text className={`text-sm font-semibold ${mode === "login" ? "text-purple-700" : "text-gray-500"}`}>Login</Text>
        </Pressable>
        <Pressable onPress={() => switchMode("register")} className={`flex-1 items-center rounded-md py-2 ${mode === "register" ? "bg-white" : ""}`}>
          <Text className={`text-sm font-semibold ${mode === "register" ? "text-purple-700" : "text-gray-500"}`}>Sign up</Text>
        </Pressable>
      </View>

      {err ? (
        <View className="mb-4">
          <ErrorBanner message={err} />
        </View>
      ) : null}

      {step === "details" ? (
        <View className="gap-4">
          {mode === "register" ? (
            <FormInput label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Name" autoCapitalize="words" required />
          ) : null}
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
                setStep("details");
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
    </AppModal>
  );
}
