"use client";

import { useMemo, useState } from "react";
import { useAssignBooking } from "@vagewell/shared";
import type { BookingWithNames } from "@vagewell/shared";
import { useAllProfiles } from "@vagewell/shared";
import { Modal, SelectField, PrimaryButton, OutlineButton } from "@/components/ui";

/**
 * Admin assigns a leaf_node member to a `requested` booking — the 'staff'
 * role is retired, so leaf_node is the only assignable role now, whether
 * the booking is Home Care or (legacy) Clinic Visit.
 */
export function ApproveAssignModal({ booking, onClose }: { booking: BookingWithNames | null; onClose: () => void }) {
  const [assignee, setAssignee] = useState("");
  const { data: profiles } = useAllProfiles(!!booking);
  const assign = useAssignBooking();

  const modeChosenByCustomer = !!booking?.service_mode;

  const candidates = useMemo(() => (profiles ?? []).filter((p) => p.role === "leaf_node"), [profiles]);
  const options = [{ value: "", label: "Choose a member…" }, ...candidates.map((p) => ({ value: p.id, label: p.full_name ?? p.id }))];

  if (!booking) return null;

  const confirm = () => {
    if (!assignee) return;
    // Only send serviceMode for a legacy booking that never had one — a
    // customer-chosen mode is already on the row and shouldn't be re-written.
    assign.mutate(
      { id: booking.id, assignedTo: assignee, serviceMode: modeChosenByCustomer ? undefined : "home_care" },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal open={!!booking} onClose={onClose}>
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
        <OutlineButton onClick={onClose}>Cancel</OutlineButton>
        <PrimaryButton disabled={!assignee} loading={assign.isPending} onClick={confirm}>
          Confirm
        </PrimaryButton>
      </div>
    </Modal>
  );
}
