"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Download, Users, FileSearch, Activity } from "lucide-react";
import {
  PageHeader,
  TabBar,
  DataTable,
  Pill,
  SelectInput,
  PrimaryButton,
  LoadingState,
  EmptyState,
  ErrorBanner,
} from "@/components/ui";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  useMyBookings,
  useAllBookings,
  useFamilyMembers,
  useAllProfiles,
} from "@/lib/hooks";
import { useSetUserRole } from "@/lib/mutations";
import { PatientBookingCard } from "@/components/feature/PatientBookingCard";
import { PaymentReviewModal } from "@/components/feature/PaymentReviewModal";
import { VitalsModal, type VitalsSubject } from "@/components/feature/VitalsModal";
import { exportAppointmentsToExcel } from "@/lib/export";
import { money, PAYMENT_STATUS_META } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { ROLES } from "@shared/constants";
import type { BookingWithNames, Role } from "@shared/types";

// SCREEN_ID: DASHBOARD
export default function DashboardPage() {
  const { profile, user, role } = useAuth();
  const [tab, setTab] = useState("all");
  const isStaff = role === "staff" || role === "admin";
  const isAdmin = role === "admin";

  if (!isStaff) return <PatientView profileName={profile?.full_name ?? "Myself"} userId={user?.id ?? ""} />;

  const tabs = [
    { key: "all", label: "All Appointments" },
    { key: "mine", label: "My Appointments" },
    ...(isAdmin ? [{ key: "users", label: "Users" }] : []),
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Manage appointments and care operations." />
      <div className="mb-4">
        <TabBar tabs={tabs} activeKey={tab} onChange={setTab} />
      </div>
      {tab === "all" && <AdminBookingsView />}
      {tab === "mine" && <PatientView profileName={profile?.full_name ?? "Myself"} userId={user?.id ?? ""} embedded />}
      {tab === "users" && isAdmin && <UsersView />}
    </div>
  );
}

// ── Patient's own appointments ───────────────────────────────────
function PatientView({
  profileName,
  userId,
  embedded = false,
}: {
  profileName: string;
  userId: string;
  embedded?: boolean;
}) {
  const { data: bookings, isLoading, error } = useMyBookings();
  const { data: deps } = useFamilyMembers();
  const depMap = useMemo(
    () => Object.fromEntries((deps ?? []).map((d) => [d.id, d.full_name])),
    [deps]
  );

  return (
    <div>
      {!embedded && <PageHeader title="My Appointments" subtitle="Your booked home-care visits." />}
      {error && <ErrorBanner message="Could not load your appointments." />}
      {isLoading && <LoadingState message="Loading appointments…" />}
      {!isLoading && bookings?.length === 0 && (
        <EmptyState icon={CalendarCheck} title="No appointments yet" description="Book a service to see it here." />
      )}
      <div className="space-y-3">
        {bookings?.map((b) => (
          <PatientBookingCard
            key={b.id}
            booking={b}
            userId={userId}
            subjectName={b.family_member_id ? depMap[b.family_member_id] ?? "Dependent" : profileName}
          />
        ))}
      </div>
    </div>
  );
}

// ── Staff/Admin: all appointments + verification + export ────────
function AdminBookingsView() {
  const { data: bookings, isLoading, error } = useAllBookings(true);
  const [selected, setSelected] = useState<BookingWithNames | null>(null);
  const [vitalsSubject, setVitalsSubject] = useState<VitalsSubject | null>(null);

  const openVitals = (r: BookingWithNames) =>
    setVitalsSubject(
      r.family_member_id
        ? { familyMemberId: r.family_member_id, name: r.subject_name ?? "Dependent" }
        : { profileId: r.account_id, name: r.subject_name ?? r.account?.full_name ?? "Patient" }
    );

  const columns = [
    { key: "account", label: "Account", render: (_: unknown, r: BookingWithNames) => r.account?.full_name ?? "—" },
    { key: "service_name", label: "Service" },
    { key: "start_date", label: "Date", render: (v: string) => formatDate(v) },
    { key: "total_amount", label: "Total", render: (v: number) => money(v) },
    {
      key: "payment_status",
      label: "Payment",
      render: (_: unknown, r: BookingWithNames) => {
        const m = PAYMENT_STATUS_META[r.payment_status];
        return <Pill bgClass={m.bg} textClass={m.text}>{m.label}</Pill>;
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: unknown, r: BookingWithNames) => (
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(r)} className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700">
            <FileSearch size={14} /> Review
          </button>
          <button onClick={() => openVitals(r)} className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
            <Activity size={14} /> Vitals
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <PrimaryButton onClick={() => exportAppointmentsToExcel(bookings ?? [])} disabled={!bookings?.length}>
          <span className="inline-flex items-center gap-1.5"><Download size={14} /> Export to Excel</span>
        </PrimaryButton>
      </div>
      {error && <ErrorBanner message="Could not load appointments." />}
      {isLoading ? (
        <LoadingState message="Loading appointments…" />
      ) : bookings?.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No appointments" description="Bookings from all users appear here." />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <DataTable columns={columns} data={bookings ?? []} />
          </div>
        </div>
      )}
      <PaymentReviewModal booking={selected} onClose={() => setSelected(null)} />
      <VitalsModal open={!!vitalsSubject} subject={vitalsSubject} onClose={() => setVitalsSubject(null)} />
    </div>
  );
}

// ── Admin: role management ───────────────────────────────────────
function UsersView() {
  const { data: users, isLoading } = useAllProfiles(true);
  const setRole = useSetUserRole();

  const roleOptions = ROLES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }));

  const columns = [
    { key: "full_name", label: "Name", render: (v: string) => v ?? "—" },
    { key: "phone", label: "Phone", render: (v: string) => v ?? "—" },
    {
      key: "role",
      label: "Role",
      render: (_: unknown, r: { id: string; role: Role }) => (
        <div className="w-36">
          <SelectInput
            value={r.role}
            options={roleOptions}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setRole.mutate({ userId: r.id, role: e.target.value as Role })
            }
            id={`role-${r.id}`}
          />
        </div>
      ),
    },
    { key: "created_at", label: "Joined", render: (v: string) => formatDate(v) },
  ];

  if (isLoading) return <LoadingState message="Loading users…" />;
  if (!users?.length)
    return <EmptyState icon={Users} title="No users" description="Registered users appear here." />;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <DataTable columns={columns} data={users} />
      </div>
    </div>
  );
}
