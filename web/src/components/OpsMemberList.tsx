"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Card, FormInput, SelectField, LoadingState, EmptyState, PageHeader } from "@/components/ui";
import { useAllProfiles, useSetUserRole, localPhone, formatDate, ROLES, type Role, type Profile } from "@vagewell/shared";

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r === "leaf_node" ? "Leaf Node" : r[0].toUpperCase() + r.slice(1) }));

/**
 * Admin-only list of accounts holding a given operational role, with an
 * inline role dropdown. With no search query it only shows current holders
 * of `role` (so this doesn't just become "everyone"); typing a name or phone
 * widens the search to every account so an existing patient can be found and
 * promoted right here. When searching, results are split into "Staff
 * portal" (ops roles) and "Patients" sections — a patient still shows up
 * (that's how one gets promoted), but grouped separately so it doesn't read
 * as if they already have portal access.
 */
export function OpsMemberList({ role, title, emptyLabel }: { role: Role; title: string; emptyLabel: string }) {
  const { data: profiles, isLoading } = useAllProfiles(true);
  const setRole = useSetUserRole();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const pool = q ? (profiles ?? []) : (profiles ?? []).filter((p) => p.role === role);
    return pool
      .filter((p) => !q || (p.full_name ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [profiles, role, q]);

  const opsRows = q ? rows.filter((p) => p.role !== "patient") : rows;
  const patientRows = q ? rows.filter((p) => p.role === "patient") : [];

  return (
    <div>
      <PageHeader title={title} />
      <div className="mb-4">
        <FormInput
          label="Search by name or phone"
          value={query}
          onChangeText={setQuery}
          placeholder="Search anyone by name or phone to promote them…"
        />
      </div>
      {isLoading ? <LoadingState message="Loading…" /> : null}
      {!isLoading && rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={q ? "No match" : `No ${emptyLabel}`}
          description={
            q
              ? "No account matches that name or phone."
              : "Search above by name or phone to find a registered account and set its role."
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {opsRows.length > 0 ? (
            <div className="flex flex-col gap-3">
              {q ? <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Staff portal</p> : null}
              {opsRows.map((p) => (
                <MemberRow key={p.id} profile={p} onSetRole={(r) => setRole.mutate({ userId: p.id, role: r })} />
              ))}
            </div>
          ) : null}
          {patientRows.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Patients (not yet on the staff portal)</p>
              {patientRows.map((p) => (
                <MemberRow key={p.id} profile={p} onSetRole={(r) => setRole.mutate({ userId: p.id, role: r })} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MemberRow({ profile: p, onSetRole }: { profile: Profile; onSetRole: (role: Role) => void }) {
  const router = useRouter();
  const detailHref = p.role === "patient" ? `/patients/${p.id}` : `/team/${p.id}`;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => router.push(detailHref)} className="text-left active:opacity-70">
          <p className="text-base font-semibold text-brand-700 underline-offset-2 hover:underline">{p.full_name ?? "—"}</p>
          <p className="text-xs text-gray-500">
            {localPhone(p.phone) || "—"} · Joined {formatDate(p.created_at)}
          </p>
        </button>
        <div className="w-40">
          <SelectField value={p.role} onValueChange={(r) => onSetRole(r as Role)} options={ROLE_OPTIONS} />
        </div>
      </div>
    </Card>
  );
}
