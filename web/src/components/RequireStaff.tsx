"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OPS_ROLES } from "@vagewell/shared";
import { useAuth } from "@/providers/AuthProvider";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState, ErrorBanner, OutlineButton, PrimaryButton } from "@/components/ui";

const isOpsRole = (role: string | null) => !!role && (OPS_ROLES as readonly string[]).includes(role);

/**
 * Client-side route guard, mirroring the mobile app's RootNavigator: role
 * enforcement lives in Postgres RLS (is_staff()/is_admin()), this is UX only —
 * a patient account that somehow lands here is bounced straight back out.
 * Covers all three operational roles (staff, admin, leaf_node).
 */
export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading, profileError, role, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const bounced = useRef(false);
  const profileResolved = !!profile && profile.id === user?.id;

  useEffect(() => {
    if (loading || (user && profileLoading && !profileResolved)) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profileResolved && !isOpsRole(role) && !bounced.current) {
      bounced.current = true;
      toast.error("This portal is for staff, admin, and leaf node accounts only.");
      void signOut().then(() => router.replace("/login"));
    }
  }, [loading, profileLoading, profileResolved, user, role, router, signOut]);

  // A failed (not just slow) profile fetch used to render the exact same
  // spinner as a genuinely in-flight one, forever — no error, no way out.
  if (!loading && user && !profileLoading && profileError && !profileResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 text-center">
          <ErrorBanner message={`Could not load your account: ${profileError}`} />
          <div className="flex justify-center gap-2">
            <OutlineButton onClick={() => void refreshProfile()}>Try again</OutlineButton>
            <PrimaryButton onClick={() => void signOut().then(() => router.replace("/login"))}>Sign out</PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !user || !profileResolved || !isOpsRole(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg">
        <LoadingState message="Loading…" />
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
