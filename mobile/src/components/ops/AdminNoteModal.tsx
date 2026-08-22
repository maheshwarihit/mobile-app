import { useState } from "react";
import { View } from "react-native";
import { useUpdateAdminNote, type BookingWithNames } from "@vagewell/shared";
import { AppModal, TextareaInput, PrimaryButton, OutlineButton } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";
import { translateTamilToEnglish } from "@/lib/translateText";

/**
 * Admin's free-text note on a booking — patient details/needs the assigned
 * leaf node should know. Saved to `bookings.admin_note` (migration 0027) and
 * folded into the WhatsApp assignment message (`assignmentMessage()`,
 * `mobile/src/lib/whatsapp.ts`) alongside the client's own symptom brief.
 * The caller must key this on `booking.id` so a fresh instance — with the
 * current note as its starting value — mounts per booking.
 */
export function AdminNoteModal({ booking, onClose }: { booking: BookingWithNames | null; onClose: () => void }) {
  const { t } = useLanguage();
  const [note, setNote] = useState(booking?.admin_note ?? "");
  const [saving, setSaving] = useState(false);
  const update = useUpdateAdminNote();

  if (!booking) return null;

  const save = async () => {
    setSaving(true);
    const translated = await translateTamilToEnglish(note.trim());
    setSaving(false);
    update.mutate({ id: booking.id, note: translated }, { onSuccess: onClose });
  };

  return (
    <AppModal visible onClose={onClose} title={t("modal.adminNote.title")}>
      <View className="gap-4">
        <TextareaInput
          label={t("modal.adminNote.label")}
          value={note}
          onChangeText={setNote}
          placeholder={t("modal.adminNote.placeholder")}
          rows={4}
          maxLength={1000}
        />
        <View className="flex-row items-center justify-end gap-3">
          <OutlineButton onPress={onClose}>{t("modal.adminNote.cancel")}</OutlineButton>
          <PrimaryButton loading={saving || update.isPending} onPress={save}>
            {t("modal.adminNote.save")}
          </PrimaryButton>
        </View>
      </View>
    </AppModal>
  );
}
