"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Card, FormInput, SelectField, LoadingState, EmptyState, PageHeader } from "@/components/ui";
import { useAllProfiles, useSetUserRole, localPhone, formatDate, ROLES, type Role } from "@vagewell/shared";

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r === "leaf_node" ? "Leaf Node" : r[0].toUpperCase() + r.slice(1) }));

/**
 * Admin-only list of accounts holding a given operational role, with an
 * inline role dropdown. With no search query it only shows current holders
 * of `role` (so this doesn't just become "everyone"); typing a name or phone
 * widens the search to every account so an existing patient can be found and
 * promoted right here — this page previously only ever showed people who
 * already had the role, with no way to add anyone new from it at all.
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
