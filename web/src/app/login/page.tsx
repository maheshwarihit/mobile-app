"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { normalizePhone, OPS_ROLES, ROLE_LABELS, type Role } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";
import { FormInput, PrimaryButton, ErrorBanner } from "@/components/ui";

type OpsRole = (typeof OPS_ROLES)[number];

// One shared login page for all three ops roles — same Supabase phone+OTP as
// the patient app, but the caller picks which panel they're signing into up
// front. The actual account role (source of truth, from `profiles.role`) is
// still checked on /verify against this pick before landing in a panel — the
// selector here is a UX front door, not the access-control boundary.
// shouldCreateUser: false — this portal never registers a new account.
export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<OpsRole>("leaf_node");
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
    router.push(`/verify?phone=${encodeURIComponent(normalized)}&role=${role}`);
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
          <div>
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Logging in as</span>
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
        <div className="mt-6 flex justify-center">
          <Link href="/register" className="text-sm text-admin-muted">
            New to VAgeWell? <span className="font-semibold text-brand-700">Register</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
