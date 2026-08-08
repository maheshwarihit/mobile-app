"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAssignBooking, useAllProfiles, waLink, type BookingWithNames, type Profile } from "@vagewell/shared";
import { Modal, SelectField, PrimaryButton, OutlineButton } from "@/components/ui";
import { assignmentMessage } from "@/lib/whatsapp";

/**
 * Admin assigns a leaf_node member to a `requested` booking — the 'staff'
 * role is retired, so leaf_node is the only assignable role now, whether
 * the booking is Home Care or (legacy) Clinic Visit.
 */
export function ApproveAssignModal({ booking, onClose }: { booking: BookingWithNames | null; onClose: () => void }) {
  const [assignee, setAssignee] = useState("");
  const { data: profiles } = useAllProfiles(!!booking);
  const assign = useAssignBooking();
  // Set once the assign mutation succeeds — swaps the form for a "message
  // them now" step instead of just closing, since that's the whole point of
  // this round: the leaf node should hear about it right away, and a wa.me
  // link is the only "free message notification" this project can send
  // without a paid WhatsApp Business API account/backend (see waLink()).
  const [assignedTo, setAssignedTo] = useState<Profile | null>(null);

  const modeChosenByCustomer = !!booking?.service_mode;

  const candidates = useMemo(() => (profiles ?? []).filter((p) => p.role === "leaf_node"), [profiles]);
  const options = [{ value: "", label: "Choose a member…" }, ...candidates.map((p) => ({ value: p.id, label: p.full_name ?? p.id }))];

  if (!booking) return null;

  const confirm = () => {
    if (!assignee) return;
    const candidate = candidates.find((p) => p.id === assignee) ?? null;
    // Only send serviceMode for a legacy booking that never had one — a
    // customer-chosen mode is already on the row and shouldn't be re-written.
    assign.mutate(
      { id: booking.id, assignedTo: assignee, serviceMode: modeChosenByCustomer ? undefined : "home_care" },
      { onSuccess: () => setAssignedTo(candidate) }
    );
  };

  const close = () => {
    setAssignee("");
    setAssignedTo(null);
    onClose();
  };

  if (assignedTo) {
    const link = waLink(assignedTo.phone, assignmentMessage(booking));
    return (
      <Modal open onClose={close}>
        <h3 className="mb-1 text-lg font-bold text-gray-900">Assigned to {assignedTo.full_name ?? "—"}</h3>
        <p className="mb-4 text-sm text-gray-500">Let them know right away — opens WhatsApp with the details pre-filled.</p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white active:opacity-80"
          >
            <MessageCircle size={16} />
            Message on WhatsApp
          </a>
        ) : (
          <p className="text-xs text-amber-700">This member has no phone number on file — can&apos;t open WhatsApp for them.</p>
        )}
        <div className="mt-4 flex justify-end">
          <OutlineButton onClick={close}>Done</OutlineButton>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={!!booking} onClose={close}>
      <h3 className="mb-1 text-lg font-bold text-gray-900">Approve &amp; Assign</h3>
      <p className="mb-4 text-sm text-gray-500">
        {booking.service_name} for <span className="font-medium">{booking.subject_name}</span>
      </p>

      <div className="flex flex-col gap-4">
        <SelectField label="Assign leaf node member" value={assignee} onValueChange={setAssignee} options={options} />
        {candidates.length === 0 ? (
          <p className="text-xs text-amber-700">No leaf node accounts yet — promote one from the Leaf Nodes page first.</p>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <OutlineButton onClick={close}>Cancel</OutlineButton>
        <PrimaryButton disabled={!assignee} loading={assign.isPending} onClick={confirm}>
          Confirm
        </PrimaryButton>
      </div>
    </Modal>
  );
}
