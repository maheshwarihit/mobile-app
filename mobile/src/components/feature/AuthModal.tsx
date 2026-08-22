import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { toast } from "sonner-native";
import { ArrowLeft } from "lucide-react-native";
import {
  AppModal,
  FormInput,
  OtpInput,
  ChoiceChips,
  PrimaryButton,
  OutlineButton,
  TextButton,
  ErrorBanner,
  GoogleIcon,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { signInWithProvider, type OAuthProvider } from "@/lib/oauth";
import { useResendTimer } from "@/hooks/useResendTimer";
import { useLanguage } from "@/lib/i18n";
import { normalizePhone, OTP_LENGTH } from "@vagewell/shared";

type Mode = "login" | "register";
type Step = "details" | "otp";
type OpsRole = "admin" | "leaf_node";

// Must match migration 0038 (handle_new_user()) exactly — the DB trigger
// already silently downgrades a mismatched name to a plain 'patient' account
// rather than erroring, so this client-side check exists purely so someone
// who picks Admin/Care Assistant without the right name finds out *before*
// burning a real OTP and completing sign-up, instead of being quietly landed
// in the wrong shell with no explanation.
const OPS_ROLE_REQUIRED_NAME: Record<OpsRole, string> = {
  admin: "VAgeWell_Care_qcrah",
  leaf_node: "VAgeWell_Care_ln",
};

/**
 * Centered sign-in/sign-up popup, opened from the Landing and Home screens.
 * Sign-up only ever collects Name + Phone here — age/gender/address/etc. are
 * filled in later from the Profile screen's edit form, not up front. No
 * manual navigation on success: RootNavigator swaps to the app shell the
 * moment the session changes, based on whatever role the account actually
 * holds — not on which door (client/staff) the caller opened this modal from.
 *
 * `allowModeSwitch={false}` locks the modal to `initialMode` and hides the
 * Login/Sign up toggle — used where a signup path genuinely doesn't apply.
 *
 * `rolePicker={true}` adds an Admin/Leaf Node choice to the Sign up step and
 * sends it as `requested_role` in the OTP signup metadata — `handle_new_user()`
 * (DB trigger) grants that role the instant the account is created, no
 * approval step. Originally a deliberate trade-off (anyone who could complete
 * an OTP on this door could make themselves an admin — see migration 0013),
 * since narrowed by migration 0038: the DB now also requires the signed-up
 * full_name to exactly match one fixed name per role (`OPS_ROLE_REQUIRED_NAME`
 * below), silently downgrading to 'patient' otherwise. This component checks
 * the same match *before* sending the OTP, so a mismatch is caught
 * immediately instead of after a real OTP was already spent. Wired to
 * Landing's Caregiver·Admin door (2026-08-11).
 *
 * Sign-up also checks `phone_registered()` (migration 0026, pre-auth RPC)
 * before sending the OTP — an already-registered number otherwise gets
 * silently OTP-logged into its existing account under the Sign-up tab
 * (`shouldCreateUser` defaults true; `requested_role`/`full_name` metadata is
 * ignored since `handle_new_user()` only fires on a brand-new account), which
 * reads as "nothing happened" rather than the actual cause.
 */
export function AuthModal({
  visible,
  onClose,
  initialMode = "register",
  allowModeSwitch = true,
  title,
  rolePicker = false,
}: {
  visible: boolean;
  onClose: () => void;
  initialMode?: Mode;
  allowModeSwitch?: boolean;
  title?: string;
  rolePicker?: boolean;
}) {
  const { t } = useLanguage();
  const ROLE_OPTIONS: { value: OpsRole; label: string }[] = [
    { value: "leaf_node", label: t("auth.role.careAssistant") },
    { value: "admin", label: t("auth.role.admin") },
  ];
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [e164, setE164] = useState("");
  const [otp, setOtp] = useState("");
  // Defaults to the lower-privilege option, not Admin — a safer default when
  // this picker is shown at all.
  const [role, setRole] = useState<OpsRole>("leaf_node");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const resend = useResendTimer(60);

  // Google never hands back a phone number — this app's identity model (RLS,
  // family-member auto-link, staff calling a patient) is built around one, so
  // signing in with Google alone isn't enough to use the app: RootNavigator
  // gates any account with no profile.phone behind VerifyPhoneScreen, which
  // collects + OTP-verifies a real number before letting the session through
  // to the normal shell. Google is a convenience on top of that gate, never a
  // way around it.
  const oauthSignIn = async (provider: OAuthProvider) => {
    setErr(null);
    setOauthBusy(provider);
    const { error } = await signInWithProvider(provider, mode === "register" && rolePicker ? role : undefined);
    setOauthBusy(null);
    if (error) setErr(error);
  };

  const reset = () => {
    setStep("details");
    setFullName("");
    setPhoneRaw("");
    setE164("");
    setOtp("");
    setRole("leaf_node");
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
          setErr(t("auth.error.noAccount"));
        } else {
          setErr(error.message);
        }
        return false;
      }
    } else {
      const data: Record<string, string> = { full_name: fullName.trim() };
      if (rolePicker) data.requested_role = role;
      const { error } = await supabase.auth.signInWithOtp({ phone, options: { data } });
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
      setErr(t("auth.error.enterName"));
      return;
    }
    if (mode === "register" && rolePicker && fullName.trim() !== OPS_ROLE_REQUIRED_NAME[role]) {
      setErr(t("auth.error.nameMismatch"));
      return;
    }
    const normalized = normalizePhone(phoneRaw);
    if (!normalized) {
      setErr(t("auth.error.invalidPhone"));
      return;
    }
    setBusy(true);
    if (mode === "register") {
      const { data: alreadyRegistered, error: checkErr } = await supabase.rpc("phone_registered", {
        p_phone: normalized,
      });
      // A failed check (e.g. migration 0026 not yet run) shouldn't block
      // sign-up outright — fall through and let the normal OTP flow proceed.
      if (!checkErr && alreadyRegistered) {
        setBusy(false);
        setErr(t("auth.error.alreadyRegistered"));
        return;
      }
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
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    toast.success(mode === "login" ? t("auth.toast.signedIn") : t("auth.toast.accountCreated"));
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
      title={title ?? (mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount"))}
    >
      {allowModeSwitch ? (
        <View className="mb-4 flex-row rounded-lg bg-gray-100 p-1">
          <Pressable onPress={() => switchMode("login")} className={`flex-1 items-center rounded-md py-2 ${mode === "login" ? "bg-white" : ""}`}>
            <Text className={`text-sm font-semibold ${mode === "login" ? "text-purple-700" : "text-gray-500"}`}>{t("auth.login")}</Text>
          </Pressable>
          <Pressable onPress={() => switchMode("register")} className={`flex-1 items-center rounded-md py-2 ${mode === "register" ? "bg-white" : ""}`}>
            <Text className={`text-sm font-semibold ${mode === "register" ? "text-purple-700" : "text-gray-500"}`}>{t("auth.signUp")}</Text>
          </Pressable>
        </View>
      ) : null}

      {err ? (
        <View className="mb-4">
          <ErrorBanner message={err} />
        </View>
      ) : null}

      {step === "details" ? (
        <View className="gap-4">
          {/* Google/Apple sign-in is a client-only convenience — an OAuth
              account has no phone number, and the Care Assistant/Admin door
              (rolePicker) is a promotable ops identity that needs one for
              RLS/household matching, so this door is OTP-only. */}
          {!rolePicker ? (
            <>
              <View className="gap-2.5">
                <OutlineButtonWithNode
                  icon={<GoogleIcon size={16} />}
                  loading={oauthBusy === "google"}
                  disabled={oauthBusy !== null}
                  onPress={() => oauthSignIn("google")}
                >
                  {t("auth.continueWithGoogle")}
                </OutlineButtonWithNode>
              </View>

              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-gray-200" />
                <Text className="text-xs text-gray-400">{t("auth.or")}</Text>
                <View className="h-px flex-1 bg-gray-200" />
              </View>
            </>
          ) : null}

          {mode === "register" ? (
            <FormInput label={t("auth.fullName")} value={fullName} onChangeText={setFullName} placeholder={t("auth.namePlaceholder")} autoCapitalize="words" required />
          ) : null}
          {mode === "register" && rolePicker ? (
            <ChoiceChips label={t("auth.registeringAs")} value={role} onChange={(v) => setRole(v as OpsRole)} options={ROLE_OPTIONS} required />
          ) : null}
          <FormInput
            label={t("auth.mobileNumber")}
            value={phoneRaw}
            onChangeText={setPhoneRaw}
            placeholder={t("auth.mobilePlaceholder")}
            keyboardType="phone-pad"
            required
          />
          <PrimaryButton fullWidth loading={busy} onPress={sendOtp}>
            {t("auth.sendOtp")}
          </PrimaryButton>
        </View>
      ) : (
        <View className="gap-4">
          <Text className="text-sm text-gray-600">{t("auth.enterCode", { length: OTP_LENGTH, phone: e164 })}</Text>
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
    </AppModal>
  );
}

/** Same visual style as `OutlineButton`, but takes an arbitrary icon node
 * (react-native-svg brand marks) instead of a `LucideIcon` component type,
 * plus its own `loading` spinner — OAuth has no separate "sending" step to
 * borrow one from. */
function OutlineButtonWithNode({
  children,
  icon,
  onPress,
  disabled,
  loading,
}: {
  children: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      className={`w-full flex-row items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 active:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:active:bg-slate-700 ${off ? "opacity-60" : ""}`}
    >
      {loading ? <ActivityIndicator size="small" color="#4b5563" /> : icon}
      <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">{children}</Text>
    </Pressable>
  );
}
