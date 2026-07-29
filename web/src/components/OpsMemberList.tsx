"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Card, FormInput, SelectField, LoadingState, EmptyState, PageHeader } from "@/components/ui";
import { useAllProfiles, useSetUserRole, localPhone, formatDate, ROLES, type Role } from "@vagewell/shared";

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r === "leaf_node" ? "Leaf Node" : r[0].toUpperCase() + r.slice(1) }));

/** Admin-only list of accounts holding a given operational role, with an inline role dropdown. */
export function OpsMemberList({ role, title, emptyLabel }: { role: Role; title: string; emptyLabel: string }) {
  const { data: profiles, isLoading } = useAllProfiles(true);
  const setRole = useSetUserRole();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (profiles ?? [])
      .filter((p) => p.role === role)
      .filter((p) => !q || (p.full_name ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [profiles, role, query]);

  return (
    <div>
      <PageHeader title={title} />
      <div className="mb-4">
        <FormInput label="Search by name or phone" value={query} onChangeText={setQuery} placeholder="Name or phone…" />
      </div>
      {isLoading ? <LoadingState message="Loading…" /> : null}
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title={`No ${emptyLabel}`} description="Promote a registered account below to see it here." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-gray-900">{p.full_name ?? "—"}</p>
                  <p className="text-xs text-gray-500">
                    {localPhone(p.phone) || "—"} · Joined {formatDate(p.created_at)}
                  </p>
                </div>
                <div className="w-40">
                  <SelectField
                    value={p.role}
                    onValueChange={(r) => setRole.mutate({ userId: p.id, role: r as Role })}
                    options={ROLE_OPTIONS}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
