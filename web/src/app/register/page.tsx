"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { normalizePhone, OTP_LENGTH, OPS_ROLES, ROLE_LABELS, type Role } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";
import { useResendTimer } from "@/hooks/useResendTimer";
import { FormInput, PrimaryButton, TextButton, ErrorBanner } from "@/components/ui";

type OpsRole = (typeof OPS_ROLES)[number];

// A brand-new phone number can create its own account directly from the
// portal, picking its own role (Staff/Admin/Leaf Node) — granted the moment
// OTP verifies, no admin approval step. This is a deliberate, explicit
// relaxation of the project's earlier "no self-service elevated roles" rule
// (user decision). `requested_role` travels as signup metadata and is only
// read by `handle_new_user()` at account CREATION (migration 0013) — an
// existing account has no way to call that path again later to escalate
// itself; only a fresh signup can set a role this way.
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [role, setRole] = useState<OpsRole>("staff");
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
      options: { shouldCreateUser: true, data: { full_name: fullName.trim(), requested_role: role } },
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
    // Use the user verifyOtp() already hands back directly — a separate
    // getUser() call right after was a race: if it fired before the new
    // session had fully settled client-side, it could come back empty,
    // making the profile lookup below match nothing and misreport as
    // "could not confirm your role" even on a perfectly successful signup.
    const { data: verifyData, error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }
    const user = verifyData.user;
    if (!user) {
      setBusy(false);
      setErr("Verification succeeded but no account was returned. Please try again.");
      return;
    }
    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) {
      setBusy(false);
      setErr(`Could not confirm your account: ${profileErr.message}`);
      return;
    }
    const actualRole = (profileRow?.role as Role | undefined) ?? null;

    // Only ever true for a genuinely brand-new number: if this phone already
    // had an account (from before, or from before 0013 ran), handle_new_user
    // never re-fires and requested_role is silently ignored — the account
    // keeps whatever role it already had. Don't pretend it worked.
    if (actualRole !== role) {
      // Don't touch full_name here — this is an existing account this
      // "registration" attempt has no business renaming.
      await supabase.auth.signOut();
      setBusy(false);
      setErr(
        actualRole
          ? `This number already has an account (registered as ${ROLE_LABELS[actualRole]}). Role selection only applies the first time a number signs up — ask an admin to change an existing account's role, or register with a different number.`
          : "No profile record was found for this account. Please try again or contact an admin."
      );
      return;
    }

    await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    setBusy(false);
    router.push(role === "admin" ? "/dashboard" : "/my-visits");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-2 text-admin-text">
          <UserPlus size={20} className="text-admin-accent" />
          <h1 className="text-lg font-bold">VAgeWell Care — New Staff Account</h1>
        </div>
        <p className="mb-5 text-sm text-admin-muted">
          New to the team? Create your account and pick your role — you&apos;re in as soon as your number is verified.
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
            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Registering as</span>
              <div className="flex gap-1.5">
                {OPS_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      role === r ? "bg-admin-accent text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {ROLE_LABELS[r as Role]}
                  </button>
                ))}
              </div>
            </div>
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
      </div>
    </div>
  );
}
