import { formatDate, localPhone, type BookingWithNames } from "@vagewell/shared";

/**
 * Mirror of `web/src/lib/whatsapp.ts` — shared by the ApproveAssign sheet
 * (right after assigning) and the admin appointment card (to re-send later),
 * so the two never drift. Kept as a copy rather than moved into `shared/`
 * because the web portal still ships its own; if the two ever need to change
 * together, that's the moment to promote it.
 */
export function assignmentMessage(booking: BookingWithNames): string {
  const lines = [
    "New assignment — VAgeWell Care",
    `Service: ${booking.service_name}`,
    `Client: ${booking.subject_name ?? "—"} (${localPhone(booking.subject_phone) || "—"})`,
    `Date: ${formatDate(booking.start_date)} at ${booking.time_slot}`,
  ];
  if (booking.symptom_brief) lines.push(`Symptom brief: ${booking.symptom_brief}`);
  if (booking.admin_note) lines.push(`Note from admin: ${booking.admin_note}`);
  return lines.join("\n");
}
