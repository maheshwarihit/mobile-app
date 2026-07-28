"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState } from "@/components/ui";

/**
 * Client-side route guard, mirroring the mobile app's RootNavigator: role
 * enforcement lives in Postgres RLS (is_staff()/is_admin()), this is UX only —
 * a patient account that somehow lands here is bounced straight back out.
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
    if (profileResolved && role !== "staff" && role !== "admin" && !bounced.current) {
      bounced.current = true;
      toast.error("This portal is for staff and admin accounts only.");
      void signOut().then(() => router.replace("/login"));
    }
  }, [loading, profileLoading, profileResolved, user, role, router, signOut]);

  if (loading || !user || !profileResolved || (role !== "staff" && role !== "admin")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg">
        <LoadingState message="Loading…" />
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
