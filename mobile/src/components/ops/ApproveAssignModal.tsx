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
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
  const [assignee, setAssignee] = useState("");
  const { data: profiles } = useAllProfiles(!!booking);
  const assign = useAssignBooking();
  const [assignedTo, setAssignedTo] = useState<Profile | null>(null);

  const modeChosenByCustomer = !!booking?.service_mode;

  const candidates = useMemo(() => (profiles ?? []).filter((p) => p.role === "leaf_node"), [profiles]);
  // display_name (the Care Giver's real name, collected separately at sign-up)
  // rather than full_name — every Care Giver shares the same fixed full_name
  // (the self-select-role gate string), which is meaningless for telling
  // candidates apart here. Falls back to full_name for an account created
  // before display_name existed (migration 0040).
  const options = useMemo(
    () => candidates.map((p) => ({ value: p.id, label: p.display_name ?? p.full_name ?? p.id })),
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
      <AppModal visible onClose={close} title={t("modal.approveAssign.assignedTitle", { name: assignedTo.display_name ?? assignedTo.full_name ?? "—" })}>
        <Text className="mb-4 text-sm text-gray-500">{t("modal.approveAssign.messageNow")}</Text>
        {link ? (
          <PrimaryButton fullWidth icon={MessageCircle} onPress={() => openUrl(link)}>
            {t("modal.approveAssign.messageOnWhatsapp")}
          </PrimaryButton>
        ) : (
          <WarningBanner message={t("modal.approveAssign.noPhone")} />
        )}
        <View className="mt-4 flex-row justify-end">
          <OutlineButton onPress={close}>{t("modal.approveAssign.done")}</OutlineButton>
        </View>
      </AppModal>
    );
  }

  return (
    <AppModal visible onClose={close} title={t("modal.approveAssign.title")}>
      <Text className="mb-4 text-sm text-gray-500">
        {t("modal.approveAssign.serviceFor", { service: translateServiceName(t, booking.service_name), name: booking.subject_name ?? "" })}
      </Text>

      <SelectSheet
        label={t("modal.approveAssign.assignLabel")}
        value={assignee}
        onValueChange={setAssignee}
        options={options}
        placeholder={t("modal.approveAssign.choosePlaceholder")}
      />
      {candidates.length === 0 ? (
        <View className="mt-3">
          <WarningBanner message={t("modal.approveAssign.noCandidates")} />
        </View>
      ) : null}

      <View className="mt-6 flex-row justify-end gap-3">
        <OutlineButton onPress={close}>{t("modal.approveAssign.cancel")}</OutlineButton>
        <PrimaryButton disabled={!assignee} loading={assign.isPending} onPress={confirm}>
          {t("modal.approveAssign.confirm")}
        </PrimaryButton>
      </View>
    </AppModal>
  );
}
