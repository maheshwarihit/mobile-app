"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { FormInput, SelectInput, TextareaInput, PrimaryButton, TextButton } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/phone";
import { registerSchema } from "@/lib/schemas";
import { HOW_HEARD_OPTIONS, HOW_HEARD_LABELS, HOW_HEARD_DEFAULT, OTP_LENGTH } from "@shared/constants";

const HOW_HEARD_SELECT = HOW_HEARD_OPTIONS.map((v) => ({ value: v, label: HOW_HEARD_LABELS[v] }));

// SCREEN_ID: REGISTER
export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

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
    // Ensure profile fields are set (the signup trigger also reads metadata).
    const { data: { user } } = await supabase.auth.getUser();
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
    router.replace("/services");
  };

  return (
    <main className="auth-bg flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600">
            <HeartPulse size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-600">A verification code will confirm your number.</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {step === "details" ? (
            <div className="space-y-4">
              <FormInput label="Full Name" value={form.full_name} onChange={set("full_name")} placeholder="e.g. Anitha Kumar" error={errors.full_name} id="full_name" required />
              <FormInput label="Mobile Number" type="tel" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" error={errors.phone} id="phone" required />
              <FormInput label="Age (optional)" type="number" value={form.age} onChange={set("age")} placeholder="Age" error={errors.age} id="age" />
              <SelectInput label="How do you know about VAgeWell?" value={form.how_heard} onChange={set("how_heard")} options={HOW_HEARD_SELECT} id="how_heard" />
              <TextareaInput label="How well are you? (optional)" value={form.wellness_note} onChange={set("wellness_note")} placeholder="Briefly describe how you're feeling…" rows={3} maxLength={1000} id="wellness_note" />
              <PrimaryButton onClick={submitDetails} disabled={busy} fullWidth>
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                placeholder="6-digit code"
                error={errors.otp}
                id="otp"
                required
              />
              <PrimaryButton onClick={verify} disabled={busy} fullWidth>
                {busy ? "Verifying…" : "Verify & Create Account"}
              </PrimaryButton>
              <TextButton onClick={() => { setStep("details"); setOtp(""); setErrors({}); }} icon={ArrowLeft}>
                Back to details
              </TextButton>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-purple-700 hover:text-purple-800">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
