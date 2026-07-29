"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OPS_ROLES } from "@vagewell/shared";
import { useAuth } from "@/providers/AuthProvider";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState } from "@/components/ui";

const isOpsRole = (role: string | null) => !!role && (OPS_ROLES as readonly string[]).includes(role);

/**
 * Client-side route guard, mirroring the mobile app's RootNavigator: role
 * enforcement lives in Postgres RLS (is_staff()/is_admin()), this is UX only —
 * a patient account that somehow lands here is bounced straight back out.
 * Covers all three operational roles (staff, admin, leaf_node).
 */
export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading, role, signOut } = useAuth();
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

  if (loading || !user || !profileResolved || !isOpsRole(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg">
        <LoadingState message="Loading…" />
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
