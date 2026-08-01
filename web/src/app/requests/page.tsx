"use client";

import { useState } from "react";
import { PhoneIncoming, Check, Phone, Plus } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { Card, Pill, IconButton, LoadingState, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { NewRequestModal } from "@/components/NewRequestModal";
import { useBookingRequests, useMarkRequestContacted, localPhone, formatLocalDateTime, type BookingRequestWithAccount } from "@vagewell/shared";

// SCREEN_ID: BOOKING_REQUESTS — the "Request for Booking" quick-contact inbox.
// Admin-only: a lightweight lead capture, distinct from a real booking (no
// service/date/payment) — mark it contacted once someone from the team has
// called the customer back. The "+" logs an incoming phone call as a request
// directly against a chosen patient's account (0017) — previously the only
// way into this table was the customer tapping the button in their own app.
function RequestsContent() {
  const { data: requests, isLoading } = useBookingRequests(true);
  const markContacted = useMarkRequestContacted();
  const [adding, setAdding] = useState(false);

  const open = (requests ?? []).filter((r) => !r.contacted);
  const contacted = (requests ?? []).filter((r) => r.contacted);

  return (
    <div>
      <PageHeader title="Booking requests" right={<IconButton icon={Plus} onClick={() => setAdding(true)} />} />
      <p className="mb-4 text-xs text-gray-500">
        Customers who tapped &ldquo;Request for Booking&rdquo; in the app — call them back, then mark contacted.
        Use + to log a call-in request yourself.
      </p>

      {isLoading ? <LoadingState message="Loading…" /> : null}
      {!isLoading && (requests ?? []).length === 0 ? (
        <EmptyState icon={PhoneIncoming} title="No requests yet" description="New requests appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {open.map((r) => (
            <RequestCard key={r.id} request={r} onContact={() => markContacted.mutate(r.id)} pending={markContacted.isPending} />
          ))}
          {contacted.length > 0 ? (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Contacted</p>
              {contacted.map((r) => (
                <RequestCard key={r.id} request={r} />
              ))}
            </>
          ) : null}
        </div>
      )}

      <NewRequestModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function RequestCard({
  request: r,
  onContact,
  pending,
}: {
  request: BookingRequestWithAccount;
  onContact?: () => void;
  pending?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{r.account?.full_name ?? "—"}</p>
          <p className="text-xs text-gray-500">{localPhone(r.account?.phone) || "—"}</p>
          {r.note ? <p className="mt-1 text-xs text-gray-500">{r.note}</p> : null}
          <p className="mt-1 text-xs text-gray-400">{formatLocalDateTime(r.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {r.contacted ? (
            <Pill bgClass="bg-emerald-50" textClass="text-emerald-700">
              Contacted
            </Pill>
          ) : (
            <Pill bgClass="bg-amber-50" textClass="text-amber-700">
              New
            </Pill>
          )}
          {!r.contacted && onContact ? (
            <PrimaryButton icon={Check} loading={pending} onClick={onContact}>
              Mark contacted
            </PrimaryButton>
          ) : null}
          {r.account?.phone ? (
            <a href={`tel:${r.account.phone}`} className="flex items-center gap-1 text-xs font-medium text-brand-600">
              <Phone size={12} />
              Call
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function RequestsPage() {
  return (
    <RequireStaff>
      <RequestsContent />
    </RequireStaff>
  );
}
