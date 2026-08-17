import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { MessageCircle } from "lucide-react-native";
import {
  useAssignBooking,
  useAllProfiles,
  waLink,
  type BookingWithNames,
  type Profile,
} from "@vagewell/shared";
import { AppModal, SelectSheet, PrimaryButton, OutlineButton, WarningBanner } from "@/components/ui";
import { assignmentMessage } from "@/lib/whatsapp";
import { openUrl } from "@/lib/signedUrl";

/**
 * Admin assigns a leaf_node member to a `requested` booking. The 'staff' role
 * is retired (0021), so leaf_node is the only assignable role — the DB's
 * assignment guard enforces the same thing, this just doesn't offer choices
 * the server would reject.
 *
 * Mirrors web/src/components/ApproveAssignModal.tsx, including the post-assign
 * "message them now" step: a wa.me deep link is the only free WhatsApp
 * notification this project can send without a paid Business API account.
 */
export function ApproveAssignModal({
  booking,
  onClose,
}: {
  booking: BookingWithNames | null;
  onClose: () => void;
}) {
  const [assignee, setAssignee] = useState("");
  const { data: profiles } = useAllProfiles(!!booking);
  const assign = useAssignBooking();
  const [assignedTo, setAssignedTo] = useState<Profile | null>(null);

  const modeChosenByCustomer = !!booking?.service_mode;

  const candidates = useMemo(() => (profiles ?? []).filter((p) => p.role === "leaf_node"), [profiles]);
  const options = useMemo(
    () => candidates.map((p) => ({ value: p.id, label: p.full_name ?? p.id })),
    [candidates]
  );

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
      <AppModal visible onClose={close} title={`Assigned to ${assignedTo.full_name ?? "—"}`}>
        <Text className="mb-4 text-sm text-gray-500">
          Let them know right away — opens WhatsApp with the details pre-filled.
        </Text>
        {link ? (
          <PrimaryButton fullWidth icon={MessageCircle} onPress={() => openUrl(link)}>
            Message on WhatsApp
          </PrimaryButton>
        ) : (
          <WarningBanner message="This member has no phone number on file — can't open WhatsApp for them." />
        )}
        <View className="mt-4 flex-row justify-end">
          <OutlineButton onPress={close}>Done</OutlineButton>
        </View>
      </AppModal>
    );
  }

  return (
    <AppModal visible onClose={close} title="Approve & Assign">
      <Text className="mb-4 text-sm text-gray-500">
        {booking.service_name} for <Text className="font-medium text-gray-700">{booking.subject_name}</Text>
      </Text>

      <SelectSheet
        label="Assign leaf node member"
        value={assignee}
        onValueChange={setAssignee}
        options={options}
        placeholder="Choose a member…"
      />
      {candidates.length === 0 ? (
        <View className="mt-3">
          <WarningBanner message="No leaf node accounts yet — promote one from the Team tab first." />
        </View>
      ) : null}

      <View className="mt-6 flex-row justify-end gap-3">
        <OutlineButton onPress={close}>Cancel</OutlineButton>
        <PrimaryButton disabled={!assignee} loading={assign.isPending} onPress={confirm}>
          Confirm
        </PrimaryButton>
      </View>
    </AppModal>
  );
}
