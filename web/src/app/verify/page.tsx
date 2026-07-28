"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { OTP_LENGTH } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";
import { useResendTimer } from "@/hooks/useResendTimer";
import { PrimaryButton, TextButton, ErrorBanner, FormInput } from "@/components/ui";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const e164 = params.get("phone") ?? "";
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
    // RequireStaff (mounted on every protected route) checks the role and
    // bounces non-staff accounts back out; here we just move past the gate.
    router.push("/dashboard");
  };

  if (!e164) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-600">
        Missing phone number.{" "}
        <TextButton onClick={() => router.replace("/login")}>Back to login</TextButton>
      </div>
    );
  }

  return (
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
        Verify &amp; Continue
      </PrimaryButton>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-5 text-lg font-bold text-admin-text">Verify</h1>
        <Suspense fallback={null}>
          <VerifyForm />
        </Suspense>
      </div>
    </div>
  );
}
