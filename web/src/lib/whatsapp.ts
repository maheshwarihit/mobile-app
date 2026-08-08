import { formatDate, localPhone, type BookingWithNames } from "@vagewell/shared";

/** Shared by ApproveAssignModal (right after assigning) and the Dashboard's
 * BookingCard (to re-send later) — kept in one place so the two never drift. */
export function assignmentMessage(booking: BookingWithNames): string {
  const lines = [
    "New assignment — VAgeWell Care",
    `Service: ${booking.service_name}`,
    `Client: ${booking.subject_name ?? "—"} (${localPhone(booking.subject_phone) || "—"})`,
    `Date: ${formatDate(booking.start_date)} at ${booking.time_slot}`,
  ];
  if (booking.symptom_brief) lines.push(`Note: ${booking.symptom_brief}`);
  return lines.join("\n");
}
