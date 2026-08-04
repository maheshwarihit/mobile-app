"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, PlayCircle, UploadCloud, CheckCircle2, Eye } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { Card, Pill, LoadingState, EmptyState, ErrorBanner, ConfirmModal, PageHeader } from "@/components/ui";
import { VitalsModal, type VitalsSubject } from "@/components/VitalsModal";
import { ReportUploadModal } from "@/components/ReportUploadModal";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  useMyAssignedBookings,
  useStartVisit,
  useCompleteVisit,
  useReportsForBooking,
  money,
  formatDate,
  formatLocalDateTime,
  bookingStatusMeta,
  MEDICAL_REPORT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type BookingWithNames,
} from "@vagewell/shared";

function MyVisitsContent() {
  const { role } = useAuth();
  const { data: bookings, isLoading, error } = useMyAssignedBookings(true);
  const [vitals, setVitals] = useState<VitalsSubject | null>(null);
  const [reporting, setReporting] = useState<BookingWithNames | null>(null);

  const active = (bookings ?? []).filter((b) => b.booking_status !== "completed" && b.booking_status !== "cancelled");

  const openVitals = (b: BookingWithNames) =>
    setVitals(
      b.family_member_id
        ? { familyMemberId: b.family_member_id, name: b.subject_name ?? "Dependent" }
        : { profileId: b.account_id, name: b.subject_name ?? b.account?.full_name ?? "Client" }
    );

  return (
    <div>
      <PageHeader title={role === "leaf_node" ? "Assigned Home Visits" : "Assigned Appointments"} />

      {error ? <ErrorBanner message="Could not load your visits." /> : null}
      {isLoading ? <LoadingState message="Loading…" /> : null}
      {!isLoading && active.length === 0 ? (
        <EmptyState title="No assigned visits" description="Work an admin assigns to you appears here." />
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((b) => (
            <VisitCard key={b.id} booking={b} onVitals={() => openVitals(b)} onReport={() => setReporting(b)} />
          ))}
        </div>
      )}

      <VitalsModal
        key={vitals ? `${vitals.profileId ?? ""}:${vitals.familyMemberId ?? ""}` : "none"}
        open={!!vitals}
        subject={vitals}
        onClose={() => setVitals(null)}
      />
      <ReportUploadModal key={reporting?.id ?? "none-report"} booking={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}

function VisitCard({ booking, onVitals, onReport }: { booking: BookingWithNames; onVitals: () => void; onReport: () => void }) {
  const status = bookingStatusMeta(booking.booking_status);
  const start = useStartVisit();
  const complete = useCompleteVisit();
  const { data: reports } = useReportsForBooking(booking.id);
  const latestReport = reports?.[0] ?? null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canStart = booking.booking_status === "assigned";
  const inFlight = booking.booking_status === "in_progress" || booking.booking_status === "report_uploaded";

  // Fetched up front and rendered as a real <a href>, not a click handler
  // that calls window.open() after an await — browsers' popup blockers
  // silently swallow that (it's no longer a direct user gesture by the time
  // the signed URL comes back), which looked like "nothing happens on click".
  const { data: reportUrl } = useQuery({
    queryKey: ["report-signed-url", latestReport?.storage_path ?? "none"],
    enabled: !!latestReport,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from(MEDICAL_REPORT_BUCKET)
        .createSignedUrl(latestReport!.storage_path, SIGNED_URL_TTL_SECONDS);
      return data?.signedUrl ?? null;
    },
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-900">{booking.service_name}</p>
          <p className="text-xs text-gray-500">
            Client <span className="font-medium text-brand-600">{booking.subject_name ?? "—"}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {formatDate(booking.start_date)} · {money(booking.total_amount)}
          </p>
          {latestReport ? (
            <p className="mt-0.5 text-xs text-gray-400">
              Report uploaded: {latestReport.file_name ?? "file"} · {formatLocalDateTime(latestReport.created_at)}
            </p>
          ) : null}
        </div>
        <Pill bgClass={status.bg} textClass={status.text}>
          {status.label}
        </Pill>
      </div>

      <div className="mt-3 flex flex-wrap gap-5 border-t border-gray-100 pt-3">
        {canStart ? (
          <button onClick={() => start.mutate(booking.id)} disabled={start.isPending} className="flex items-center gap-1 text-sm font-medium text-brand-600 active:opacity-70">
            <PlayCircle size={14} />
            Start Visit
          </button>
        ) : null}
        {inFlight ? (
          <button onClick={onVitals} className="flex items-center gap-1 text-sm font-medium text-gray-600 active:opacity-70">
            <Activity size={14} />
            Vitals
          </button>
        ) : null}
        {canStart || inFlight ? (
          <button onClick={onReport} className="flex items-center gap-1 text-sm font-medium text-gray-600 active:opacity-70">
            <UploadCloud size={14} />
            Upload Report
          </button>
        ) : null}
        {reportUrl ? (
          <a
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-gray-600 active:opacity-70"
          >
            <Eye size={14} />
            View Report
          </a>
        ) : null}
        {inFlight ? (
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

      <ConfirmModal
        open={confirmOpen}
        title="Mark visit complete?"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          complete.mutate(booking.id);
          setConfirmOpen(false);
        }}
        confirmLabel="Mark complete"
        cancelLabel="Not yet"
      >
        <p className="text-sm text-gray-600">
          This closes the {booking.service_name} visit on {formatDate(booking.start_date)} and removes it from your active list.
        </p>
      </ConfirmModal>
    </Card>
  );
}

export default function MyVisitsPage() {
  return (
    <RequireStaff>
      <MyVisitsContent />
    </RequireStaff>
  );
}
