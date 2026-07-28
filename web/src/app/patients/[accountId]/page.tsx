"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { UserCircle, Users, ChevronRight } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { SectionCard, SelectField, LoadingState, EmptyState, PageHeader } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useAllProfiles, useFamilyMembersByAccount, useSetUserRole, localPhone, ROLES, type Role } from "@vagewell/shared";

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }));

function PatientProfileContent({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { role: myRole } = useAuth();
  const isAdmin = myRole === "admin";
  const { data: profiles } = useAllProfiles(true);
  const { data: dependents, isLoading } = useFamilyMembersByAccount(accountId);
  const setRole = useSetUserRole();

  const profile = (profiles ?? []).find((p) => p.id === accountId);
  const patientName = profile?.full_name ?? "Patient";

  return (
    <div>
      <PageHeader title="Family members" onBack={() => router.push("/patients")} />

      <SectionCard icon={UserCircle} title={patientName} subtitle="Account holder">
        <button
          onClick={() => router.push(`/patients/${accountId}/self`)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-left active:opacity-80"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">Edit record</p>
            <p className="text-xs text-gray-500">{localPhone(profile?.phone) || "—"} · vitals & medical</p>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </button>

        {isAdmin ? (
          <div className="mt-4">
            <SelectField
              label="Role"
              value={profile?.role ?? "patient"}
              options={ROLE_OPTIONS}
              onValueChange={(r) => setRole.mutate({ userId: accountId, role: r as Role })}
            />
          </div>
        ) : null}
      </SectionCard>

      <SectionCard icon={Users} title="Dependents" subtitle="Tap to edit a member's record">
        {isLoading ? (
          <LoadingState message="Loading…" />
        ) : (dependents?.length ?? 0) === 0 ? (
          <EmptyState icon={Users} title="No dependents" description="This account has no dependents." />
        ) : (
          <div className="flex flex-col gap-2">
            {dependents?.map((d) => (
              <button
                key={d.id}
                onClick={() => router.push(`/patients/${accountId}/dependents/${d.id}`)}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-left active:opacity-80"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{d.full_name}</p>
                  <p className="text-xs capitalize text-gray-500">
                    {d.relationship}
                    {d.age != null ? ` · ${d.age} yrs` : ""}
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

export default function PatientProfilePage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  return (
    <RequireStaff>
      <PatientProfileContent accountId={accountId} />
    </RequireStaff>
  );
}
