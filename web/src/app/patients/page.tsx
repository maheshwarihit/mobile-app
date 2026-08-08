"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, ChevronRight } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { Card, Pill, FormInput, LoadingState, EmptyState, PageHeader } from "@/components/ui";
import { ProfileAvatar, ProfileCompletionRing, profileCompletionPercent } from "@/components/ProfileSummary";
import { useAllProfiles, useAllFamilyMembers, formatDate, localPhone, type Profile } from "@vagewell/shared";

// Completion %/photo only apply to account holders — a `family_members` row
// has no `avatar_path`/age/gender/dob of its own unless it's linked to its
// own profile, which would need a second lookup; kept simple and scoped to
// what actually carries those fields directly.
type PatientRow =
  | { kind: "account"; key: string; name: string; phone: string | null; detail: string; accountId: string; profile: Profile }
  | { kind: "dependent"; key: string; name: string; phone: string | null; detail: string; accountId: string; familyMemberId: string };

function PatientsContent() {
  const router = useRouter();
  const { data: profiles, isLoading: profilesLoading } = useAllProfiles(true);
  const { data: dependents, isLoading: depsLoading } = useAllFamilyMembers(true);
  const [query, setQuery] = useState("");
  const isLoading = profilesLoading || depsLoading;

  const rows = useMemo<PatientRow[]>(() => {
    const all = profiles ?? [];
    const nameById = new Map(all.map((p) => [p.id, p.full_name ?? "—"]));

    const accounts: PatientRow[] = all
      .filter((p) => p.role === "patient")
      .map((p) => ({
        kind: "account",
        key: `p:${p.id}`,
        name: p.full_name ?? "—",
        phone: p.phone,
        detail: `${localPhone(p.phone) || "—"} · Joined ${formatDate(p.created_at)}`,
        accountId: p.id,
        profile: p,
      }));

    const members: PatientRow[] = (dependents ?? []).map((d) => ({
      kind: "dependent",
      key: `f:${d.id}`,
      name: d.full_name,
      phone: d.contact_phone,
      detail: `${d.relationship[0].toUpperCase()}${d.relationship.slice(1)} of ${nameById.get(d.account_id) ?? "—"} · ${localPhone(d.contact_phone) || "no number"}`,
      accountId: d.account_id,
      familyMemberId: d.id,
    }));

    const q = query.trim().toLowerCase();
    return [...accounts, ...members]
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.phone ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, dependents, query]);

  const open = (r: PatientRow) =>
    r.kind === "account"
      ? router.push(`/patients/${r.accountId}`)
      : router.push(`/patients/${r.accountId}/dependents/${r.familyMemberId}`);

  return (
    <div>
      <PageHeader title="Clients" />
      <div className="mb-4">
        <FormInput label="Search client" value={query} onChangeText={setQuery} placeholder="Name or phone…" />
      </div>
      {isLoading ? <LoadingState message="Loading clients…" /> : null}
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={Users} title="No clients" description="Registered clients and family members appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <button key={r.key} onClick={() => open(r)} className="text-left active:opacity-80">
              <Card className="flex items-center gap-3 p-4">
                {r.kind === "account" ? <ProfileAvatar profile={r.profile} size={40} /> : null}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-gray-900">{r.name}</p>
                    {r.kind === "dependent" ? (
                      <Pill bgClass="bg-brand-50" textClass="text-brand-700">
                        Family member
                      </Pill>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500">{r.detail}</p>
                </div>
                {r.kind === "account" ? <ProfileCompletionRing percent={profileCompletionPercent(r.profile)} size={36} /> : null}
                <ChevronRight size={18} className="text-gray-400" />
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PatientsPage() {
  return (
    <RequireStaff>
      <PatientsContent />
    </RequireStaff>
  );
}
