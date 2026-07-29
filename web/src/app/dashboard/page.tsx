"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileSearch, UserPlus2, CalendarDays, UploadCloud } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { useAuth } from "@/providers/AuthProvider";
import {
  Card,
  Pill,
  FormInput,
  OutlineButton,
  LoadingState,
  EmptyState,
  ErrorBanner,
  PageHeader,
} from "@/components/ui";
import { PaymentReviewModal } from "@/components/PaymentReviewModal";
import { ApproveAssignModal } from "@/components/ApproveAssignModal";
import { ReportUploadModal } from "@/components/ReportUploadModal";
import { exportAppointmentsToExcel } from "@/lib/export";
import {
  useAllBookings,
  useAllClinicalRecords,
  money,
  formatDate,
  paymentStatusMeta,
  bookingStatusMeta,
  type BookingWithNames,
} from "@vagewell/shared";

// Admin lands here after login; staff/leaf_node accounts belong on their own
// scoped "My Visits" view (see OPS_NAV in AdminShell) — bounce them there
// instead of showing the full cross-account appointment list.
function AdminOnlyRedirect() {
  const { role, profileLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!profileLoading && role && role !== "admin") router.replace("/my-visits");
  }, [profileLoading, role, router]);
  return null;
}

function DashboardContent() {
  const { role } = useAuth();
  const { data: bookings, isLoading, error } = useAllBookings(true);
  const clinical = useAllClinicalRecords(false);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState<BookingWithNames | null>(null);
  const [approving, setApproving] = useState<BookingWithNames | null>(null);
  const [reporting, setReporting] = useState<BookingWithNames | null>(null);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bookings ?? []).filter((b) => {
      if (day && b.start_date !== day) return false;
      if (!q) return true;
      return (
        (b.subject_name ?? "").toLowerCase().includes(q) ||
        (b.account?.full_name ?? "").toLowerCase().includes(q) ||
        b.service_name.toLowerCase().includes(q)
      );
    });
  }, [bookings, query, day]);

  const doExport = async () => {
    setExporting(true);
    try {
      const { data: v } = await clinical.refetch();
      await exportAppointmentsToExcel(bookings ?? [], v ?? []);
    } catch {
      toast.error("Could not export. Please try again.");
    }
    setExporting(false);
  };

  if (role && role !== "admin") return <AdminOnlyRedirect />;

  return (
    <div>
      <PageHeader
        title="All appointments"
        right={
          <OutlineButton icon={Download} onClick={doExport} loading={exporting}>
            Export
          </OutlineButton>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <FormInput label="Search by patient or service" value={query} onChangeText={setQuery} placeholder="Name or service…" />
        </div>
        <div className="sm:w-56">
          <FormInput label="Filter by date" value={day} onChangeText={setDay} type="date" icon={CalendarDays} />
        </div>
      </div>

      {error ? <ErrorBanner message="Could not load appointments." /> : null}
      {isLoading ? <LoadingState message="Loading appointments…" /> : null}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState title="No appointments" description="Bookings from all users appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              onReview={() => setSelected(b)}
              onApprove={() => setApproving(b)}
              onUploadReport={() => setReporting(b)}
            />
          ))}
        </div>
      )}

      <PaymentReviewModal key={selected?.id ?? "none"} booking={selected} onClose={() => setSelected(null)} />
      <ApproveAssignModal key={approving?.id ?? "none-approve"} booking={approving} onClose={() => setApproving(null)} />
      <ReportUploadModal key={reporting?.id ?? "none-report"} booking={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}

function BookingCard({
  booking,
  onReview,
  onApprove,
  onUploadReport,
}: {
  booking: BookingWithNames;
  onReview: () => void;
  onApprove: () => void;
  onUploadReport: () => void;
}) {
  const m = paymentStatusMeta(booking.payment_status);
  const status = bookingStatusMeta(booking.booking_status);
  const isCancelled = booking.booking_status === "cancelled";
  const isRequested = booking.booking_status === "requested";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-900">{booking.service_name}</p>
          <p className="text-xs text-gray-500">
            {booking.account?.full_name ?? "—"} Patient{" "}
            <span className="font-medium text-brand-600">{booking.subject_name ?? "—"}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {formatDate(booking.start_date)} · {money(booking.total_amount)}
          </p>
          {booking.assigned_to_name ? (
            <p className="mt-0.5 text-xs text-gray-500">Assigned to {booking.assigned_to_name}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          {!isCancelled ? (
            <Pill bgClass={m.bg} textClass={m.text}>
              {m.label}
            </Pill>
          ) : null}
          <Pill bgClass={status.bg} textClass={status.text}>
            {status.label}
          </Pill>
        </div>
      </div>

      {!isCancelled ? (
        <div className="mt-3 flex gap-5 border-t border-gray-100 pt-3">
          <button onClick={onReview} className="flex items-center gap-1 text-sm font-medium text-brand-600 active:opacity-70">
            <FileSearch size={14} />
            Review
          </button>
          {isRequested ? (
            <button onClick={onApprove} className="flex items-center gap-1 text-sm font-medium text-emerald-700 active:opacity-70">
              <UserPlus2 size={14} />
              Approve &amp; Assign
            </button>
          ) : null}
          {!isRequested ? (
            <button onClick={onUploadReport} className="flex items-center gap-1 text-sm font-medium text-gray-600 active:opacity-70">
              <UploadCloud size={14} />
              Upload Report
            </button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <RequireStaff>
      <DashboardContent />
    </RequireStaff>
  );
}
