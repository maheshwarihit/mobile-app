"use client";

import { useMemo, useState } from "react";
import { useAssignBooking } from "@vagewell/shared";
import type { BookingWithNames, ServiceMode } from "@vagewell/shared";
import { useAllProfiles } from "@vagewell/shared";
import { Modal, SelectField, PrimaryButton, OutlineButton } from "@/components/ui";

const MODE_OPTIONS: { value: ServiceMode; label: string }[] = [
  { value: "clinic", label: "Clinic Visit" },
  { value: "home_care", label: "Home Care" },
];
const MODE_LABELS: Record<ServiceMode, string> = { clinic: "Clinic Visit", home_care: "Home Care" };

/**
 * Admin assigns a staff/leaf_node member to a `requested` booking. The visit
 * type (Clinic/Home Care) is chosen by the customer at booking time now, so
 * this just reads it off the booking — the dropdown only appears as a
 * fallback for a booking created before that change, where it's still null.
 */
export function ApproveAssignModal({ booking, onClose }: { booking: BookingWithNames | null; onClose: () => void }) {
  const [legacyMode, setLegacyMode] = useState<ServiceMode>("clinic");
  const [assignee, setAssignee] = useState("");
  const { data: profiles } = useAllProfiles(!!booking);
  const assign = useAssignBooking();

  const mode = booking?.service_mode ?? legacyMode;
  const modeChosenByCustomer = !!booking?.service_mode;

  const candidates = useMemo(
    () => (profiles ?? []).filter((p) => p.role === (mode === "clinic" ? "staff" : "leaf_node")),
    [profiles, mode]
  );
  const options = [{ value: "", label: "Choose a member…" }, ...candidates.map((p) => ({ value: p.id, label: p.full_name ?? p.id }))];

  if (!booking) return null;

  const confirm = () => {
    if (!assignee) return;
    // Only send serviceMode for a legacy booking that never had one — a
    // customer-chosen mode is already on the row and shouldn't be re-written.
    assign.mutate(
      { id: booking.id, assignedTo: assignee, serviceMode: modeChosenByCustomer ? undefined : legacyMode },
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
        {modeChosenByCustomer ? (
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Visit type</span>
            <p className="text-sm text-gray-900">{MODE_LABELS[mode]} <span className="text-xs text-gray-400">(chosen by customer)</span></p>
          </div>
        ) : (
          <SelectField
            label="Service mode"
            value={legacyMode}
            onValueChange={(v) => {
              setLegacyMode(v as ServiceMode);
              setAssignee("");
            }}
            options={MODE_OPTIONS}
          />
        )}
        <SelectField
          label={mode === "clinic" ? "Assign staff member" : "Assign leaf node member"}
          value={assignee}
          onValueChange={setAssignee}
          options={options}
        />
        {candidates.length === 0 ? (
          <p className="text-xs text-amber-700">
            No {mode === "clinic" ? "staff" : "leaf node"} accounts yet — promote one from the{" "}
            {mode === "clinic" ? "Staff" : "Leaf Nodes"} page first.
          </p>
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
