"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { FormInput, PrimaryButton, TextButton } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/phone";
import { OTP_LENGTH } from "@shared/constants";

// SCREEN_ID: LOGIN
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-bg min-h-screen" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/services";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [e164, setE164] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sendOtp = async () => {
    setErr(null);
    const normalized = normalizePhone(phoneRaw);
    if (!normalized) {
      setErr("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setE164(normalized);
    setStep("otp");
    toast.success(`Verification code sent to ${normalized}`);
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
    toast.success("Signed in");
    router.replace(next);
  };

  return (
    <main className="auth-bg flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600">
            <HeartPulse size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-600">Log in with your mobile number.</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {step === "phone" ? (
            <div className="space-y-4">
              <FormInput
                label="Mobile Number"
                type="tel"
                value={phoneRaw}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneRaw(e.target.value)}
                placeholder="10-digit mobile number"
                error={err ?? undefined}
                id="phone"
                required
              />
              <PrimaryButton onClick={sendOtp} disabled={busy} fullWidth>
                {busy ? "Sending…" : "Send OTP"}
              </PrimaryButton>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Enter the {OTP_LENGTH}-digit code sent to <span className="font-medium">{e164}</span>.
              </p>
              <FormInput
                label="Verification Code"
                type="tel"
                value={otp}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
                }
                placeholder="6-digit code"
                error={err ?? undefined}
                id="otp"
                required
              />
              <PrimaryButton onClick={verify} disabled={busy} fullWidth>
                {busy ? "Verifying…" : "Verify & Continue"}
              </PrimaryButton>
              <div className="flex items-center justify-between">
                <TextButton onClick={() => { setStep("phone"); setOtp(""); setErr(null); }} icon={ArrowLeft}>
                  Change number
                </TextButton>
                <TextButton onClick={sendOtp}>Resend code</TextButton>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          New to VAgeWell?{" "}
          <Link href="/register" className="font-semibold text-purple-700 hover:text-purple-800">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
