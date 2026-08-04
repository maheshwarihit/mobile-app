"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Users, UserCircle, ClipboardList } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { Card, Pill, SectionCard, LoadingState, EmptyState, PageHeader } from "@/components/ui";
import {
  useAllProfiles,
  useAllBookings,
  localPhone,
  formatDate,
  formatLocalDateTime,
  money,
  bookingStatusMeta,
  ROLE_LABELS,
  type Role,
} from "@vagewell/shared";

// Tapping a staff/leaf_node member's name on /staff or /leaf-nodes lands
// here — every patient/visit ever assigned to them, newest first. bk_select
// RLS already grants any is_staff() caller every booking (0016), so this
// works the same regardless of who's viewing it, not just an admin.
function TeamMemberContent({ memberId }: { memberId: string }) {
  const router = useRouter();
  const { data: profiles, isLoading: profileLoading } = useAllProfiles(true);
  const { data: bookings, isLoading: bookingsLoading } = useAllBookings(true);

  const member = (profiles ?? []).find((p) => p.id === memberId);
  const assigned = (bookings ?? [])
    .filter((b) => b.assigned_to === memberId)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  const isLoading = profileLoading || bookingsLoading;

  return (
    <div>
      <PageHeader title="Team member" onBack={() => router.back()} />

      {isLoading ? <LoadingState message="Loading…" /> : null}

      {!isLoading && !member ? (
        <EmptyState icon={UserCircle} title="Not found" description="This account no longer exists." />
      ) : null}

      {member ? (
        <SectionCard icon={UserCircle} title={member.full_name ?? "—"} subtitle={ROLE_LABELS[member.role as Role]}>
          <p className="text-xs text-gray-500">
            {localPhone(member.phone) || "—"} · Joined {formatDate(member.created_at)}
          </p>
        </SectionCard>
      ) : null}

      <SectionCard icon={Users} title="Clients & visit history" subtitle="Every visit ever assigned to this member, newest first">
        {!isLoading && assigned.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No visits yet" description="Assigned appointments appear here." />
        ) : (
          <div className="flex flex-col gap-2">
            {assigned.map((b) => {
              const status = bookingStatusMeta(b.booking_status);
              return (
                <Card key={b.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{b.service_name}</p>
                      <p className="text-xs text-gray-500">
                        Client <span className="font-medium text-brand-600">{b.subject_name ?? "—"}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {formatDate(b.start_date)} · {money(b.total_amount)} · Booked {formatLocalDateTime(b.created_at)}
                      </p>
                    </div>
                    <Pill bgClass={status.bg} textClass={status.text}>
                      {status.label}
                    </Pill>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function TeamMemberPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params);
  return (
    <RequireStaff>
      <TeamMemberContent memberId={memberId} />
    </RequireStaff>
  );
}
