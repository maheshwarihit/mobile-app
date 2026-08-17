import { useState } from "react";
import { View } from "react-native";
import { useUpdateAdminNote, type BookingWithNames } from "@vagewell/shared";
import { AppModal, TextareaInput, PrimaryButton, OutlineButton } from "@/components/ui";

/**
 * Admin's free-text note on a booking — patient details/needs the assigned
 * leaf node should know. Saved to `bookings.admin_note` (migration 0027) and
 * folded into the WhatsApp assignment message (`assignmentMessage()`,
 * `mobile/src/lib/whatsapp.ts`) alongside the client's own symptom brief.
 * The caller must key this on `booking.id` so a fresh instance — with the
 * current note as its starting value — mounts per booking.
 */
export function AdminNoteModal({ booking, onClose }: { booking: BookingWithNames | null; onClose: () => void }) {
  const [note, setNote] = useState(booking?.admin_note ?? "");
  const update = useUpdateAdminNote();

  if (!booking) return null;

  const save = () => update.mutate({ id: booking.id, note: note.trim() }, { onSuccess: onClose });

  return (
    <AppModal visible onClose={onClose} title="Patient note">
      <View className="gap-4">
        <TextareaInput
          label="Patient details / needs"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. mobility issues, allergies, preferred visit time…"
          rows={4}
          maxLength={1000}
        />
        <View className="flex-row items-center justify-end gap-3">
          <OutlineButton onPress={onClose}>Cancel</OutlineButton>
          <PrimaryButton loading={update.isPending} onPress={save}>
            Save
          </PrimaryButton>
        </View>
      </View>
    </AppModal>
  );
}
