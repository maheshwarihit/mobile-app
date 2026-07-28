"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileSearch, Activity, CheckCircle2, CalendarDays } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import {
  Card,
  Pill,
  FormInput,
  OutlineButton,
  LoadingState,
  EmptyState,
  ErrorBanner,
  ConfirmModal,
  PageHeader,
} from "@/components/ui";
import { PaymentReviewModal } from "@/components/PaymentReviewModal";
import { VitalsModal, type VitalsSubject } from "@/components/VitalsModal";
import { exportAppointmentsToExcel } from "@/lib/export";
import {
  useAllBookings,
  useAllClinicalRecords,
  useCompleteBooking,
  money,
  formatDate,
  PAYMENT_STATUS_META,
  BOOKING_STATUS_META,
  PARA_MEDICAL_SERVICE,
  type BookingWithNames,
} from "@vagewell/shared";

function DashboardContent() {
  const { data: bookings, isLoading, error } = useAllBookings(true);
  const clinical = useAllClinicalRecords(false);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState<BookingWithNames | null>(null);
  const [vitals, setVitals] = useState<VitalsSubject | null>(null);
  const [exporting, setExporting] = useState(false);

  const all = bookings ?? [];

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

  const openVitals = (b: BookingWithNames) =>
    setVitals(
      b.family_member_id
        ? { familyMemberId: b.family_member_id, name: b.subject_name ?? "Dependent" }
        : { profileId: b.account_id, name: b.subject_name ?? b.account?.full_name ?? "Patient" }
    );

  const doExport = async () => {
    setExporting(true);
    try {
      const { data: v } = await clinical.refetch();
      await exportAppointmentsToExcel(all, v ?? []);
    } catch {
      toast.error("Could not export. Please try again.");
    }
    setExporting(false);
  };

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
            <BookingCard key={b.id} booking={b} onReview={() => setSelected(b)} onVitals={() => openVitals(b)} />
          ))}
        </div>
      )}

      <PaymentReviewModal key={selected?.id ?? "none"} booking={selected} onClose={() => setSelected(null)} />
      <VitalsModal
        key={vitals ? `${vitals.profileId ?? ""}:${vitals.familyMemberId ?? ""}` : "none"}
        open={!!vitals}
        subject={vitals}
        onClose={() => setVitals(null)}
      />
    </div>
  );
}

function BookingCard({ booking, onReview, onVitals }: { booking: BookingWithNames; onReview: () => void; onVitals: () => void }) {
  const m = PAYMENT_STATUS_META[booking.payment_status];
  const status = BOOKING_STATUS_META[booking.booking_status];
  const complete = useCompleteBooking();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const showVitals = booking.service_name === PARA_MEDICAL_SERVICE;
  const isOpen = booking.booking_status === "open";
  const isCancelled = booking.booking_status === "cancelled";

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
        </div>
        <div className="flex flex-col items-end gap-1">
          {!isCancelled ? (
            <Pill bgClass={m.bg} textClass={m.text}>
              {m.label}
            </Pill>
          ) : null}
          {!isOpen ? (
            <Pill bgClass={status.bg} textClass={status.text}>
              {status.label}
            </Pill>
          ) : null}
        </div>
      </div>

      {!isCancelled || showVitals ? (
        <div className="mt-3 flex gap-5 border-t border-gray-100 pt-3">
          {!isCancelled ? (
            <button onClick={onReview} className="flex items-center gap-1 text-sm font-medium text-brand-600 active:opacity-70">
              <FileSearch size={14} />
              Review
            </button>
          ) : null}
          {showVitals ? (
            <button onClick={onVitals} className="flex items-center gap-1 text-sm font-medium text-gray-600 active:opacity-70">
              <Activity size={14} />
              Vitals
            </button>
          ) : null}
          {isOpen ? (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={complete.isPending}
              className="flex items-center gap-1 text-sm font-medium text-emerald-700 active:opacity-70"
            >
              <CheckCircle2 size={14} />
              Complete
            </button>
          ) : null}
        </div>
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        title="Mark appointment complete?"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          complete.mutate(booking.id);
          setConfirmOpen(false);
        }}
        confirmLabel="Mark complete"
        cancelLabel="Not yet"
      >
        <p className="text-sm text-gray-600">
          This closes the {booking.service_name} visit on {formatDate(booking.start_date)}. It will move out of the patient&apos;s
          active appointments.
        </p>
      </ConfirmModal>
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
