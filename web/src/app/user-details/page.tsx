"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { LoadingState, EmptyState, PageHeader, SectionCard, Pill } from "@/components/ui";
import { ProfileCompletionRing, profileCompletionPercent } from "@/components/ProfileSummary";
import { useAllProfiles, localPhone, formatDate, isNewSignup } from "@vagewell/shared";

// SCREEN_ID: USER_DETAILS — real patient accounts, newest sign-up first.
// Purely a read of `profiles`; nothing to create here.
function UserDetailsContent() {
  const router = useRouter();
  const { data: profiles, isLoading } = useAllProfiles(true);

  const patients = useMemo(() => (profiles ?? []).filter((p) => p.role === "patient"), [profiles]);

  return (
    <div>
      <PageHeader title="User Details" />

      <SectionCard icon={Users} title="Recently registered" subtitle="Patient accounts, newest sign-up first">
        {isLoading ? (
          <LoadingState message="Loading…" />
        ) : patients.length === 0 ? (
          <EmptyState icon={Users} title="No patients yet" description="New sign-ups appear here." />
        ) : (
          <div className="flex flex-col gap-2">
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/patients/${p.id}`)}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-left active:opacity-80"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{p.full_name ?? "—"}</p>
                    <ProfileCompletionRing percent={profileCompletionPercent(p)} size={28} />
                    {isNewSignup(p.created_at) ? (
                      <Pill bgClass="bg-red-50" textClass="text-red-600">
                        New
                      </Pill>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500">
                    {localPhone(p.phone) || "—"} · Joined {formatDate(p.created_at)}
                  </p>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function UserDetailsPage() {
  return (
    <RequireStaff>
      <UserDetailsContent />
    </RequireStaff>
  );
}
