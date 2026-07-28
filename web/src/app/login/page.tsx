"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { normalizePhone } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";
import { FormInput, PrimaryButton, ErrorBanner } from "@/components/ui";

// Staff/admin portal entry — same Supabase phone+OTP as the patient app;
// role decides access after verification (RequireStaff on /verify onward).
// shouldCreateUser: false — this portal never registers a new account.
export default function LoginPage() {
  const router = useRouter();
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
    router.push(`/verify?phone=${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-2 text-admin-text">
          <Lock size={20} className="text-admin-accent" />
          <h1 className="text-lg font-bold">VAgeWell Care — Staff Portal</h1>
        </div>
        <p className="mb-5 text-sm text-admin-muted">
          Together, we manage care, support people, and create a healthier future.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6"
        >
          {err ? <ErrorBanner message={err} /> : null}
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
      </div>
    </div>
  );
}
