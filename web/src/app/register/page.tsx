"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, CheckCircle2 } from "lucide-react";
import { normalizePhone, OTP_LENGTH } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";
import { useResendTimer } from "@/hooks/useResendTimer";
import { FormInput, PrimaryButton, TextButton, ErrorBanner } from "@/components/ui";

// A brand-new phone number can create its own account directly from the
// portal — but it always lands as plain `role='patient'` (same as anyone
// registering from the mobile app; `handle_new_user()` doesn't know or care
// which app called it). There is no self-service path to an operational
// role: an admin must promote the account afterward via the Staff/Leaf Nodes
// role dropdown, same as every existing team member onboarding. This is
// deliberate — never let a self-registration pick its own elevated access.
export default function RegisterPage() {
  const [step, setStep] = useState<"details" | "otp" | "done">("details");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [e164, setE164] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const resend = useResendTimer(60);

  const sendCode = async (phone164: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone164,
      options: { shouldCreateUser: true, data: { full_name: fullName.trim() } },
    });
    if (error) {
      setErr(error.message);
      return false;
    }
    return true;
  };

  const submitDetails = async () => {
    setErr(null);
    if (!fullName.trim()) {
      setErr("Enter your full name.");
      return;
    }
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setErr("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    const ok = await sendCode(normalized);
    setBusy(false);
    if (!ok) return;
    setE164(normalized);
    resend.restart();
    setStep("otp");
  };

  const resendCode = async () => {
    setErr(null);
    setOtp("");
    if (await sendCode(e164)) resend.restart();
  };

  const verify = async () => {
    setErr(null);
    if (otp.length !== OTP_LENGTH) {
      setErr(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }
    // Backfill the profile row (the signup trigger also reads the metadata above).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    }
    // A freshly registered account is always a plain patient — sign it back
    // out rather than leave a session sitting around for a portal it can't
    // use yet (RequireStaff would bounce it on the next page load anyway).
    await supabase.auth.signOut();
    setBusy(false);
    setStep("done");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-2 text-admin-text">
          <UserPlus size={20} className="text-admin-accent" />
          <h1 className="text-lg font-bold">VAgeWell Care — New Staff Account</h1>
        </div>

        {step === "done" ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-6 text-center">
            <CheckCircle2 size={40} className="text-brand-600" />
            <p className="text-sm font-semibold text-gray-900">Account created</p>
            <p className="text-sm text-gray-600">
              Ask an admin to grant you Staff, Leaf Node, or Admin access before you log in here — new accounts
              start with no portal access until an admin assigns a role.
            </p>
            <Link href="/login" className="mt-2 text-sm font-semibold text-brand-700">
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm text-admin-muted">
              New to the team? Create your account here — an admin will grant you access afterward.
            </p>
            {step === "details" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitDetails();
                }}
                className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6"
              >
                {err ? <ErrorBanner message={err} /> : null}
                <FormInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" required />
                <FormInput
                  label="Mobile number"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="10-digit mobile number"
                  type="tel"
                  required
                />
                <PrimaryButton type="submit" fullWidth loading={busy}>
                  Send OTP
                </PrimaryButton>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void verify();
                }}
                className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6"
              >
                <p className="text-sm text-gray-600">
                  Enter the {OTP_LENGTH}-digit code sent to <span className="font-semibold">{e164}</span>.
                </p>
                {err ? <ErrorBanner message={err} /> : null}
                <FormInput
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                  placeholder="123456"
                  type="text"
                />
                <div className="flex min-h-[16px] items-center justify-center">
                  {resend.canResend ? (
                    <TextButton onClick={resendCode}>Resend OTP</TextButton>
                  ) : (
                    <span className="text-xs text-gray-500">Resend OTP in {resend.secondsLeft}s</span>
                  )}
                </div>
                <PrimaryButton type="submit" fullWidth loading={busy}>
                  Verify &amp; Create Account
                </PrimaryButton>
              </form>
            )}
            <div className="mt-6 flex justify-center">
              <Link href="/login" className="text-sm text-admin-muted">
                Already have access? <span className="font-semibold text-brand-700">Log in</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
