-- ============================================================================
-- 0027: admin note per booking, folded into the WhatsApp assignment message
-- ============================================================================
-- Admin wants to jot down the patient's details/needs against a booking and
-- have that text flow into the WhatsApp message sent to the assigned leaf
-- node (see assignmentMessage() in mobile/src/lib/whatsapp.ts). A plain
-- admin-editable column, not part of the booking_status pipeline —
-- tg_booking_update_guard() doesn't special-case it, so an update touching
-- only this column passes straight through; bk_update's `is_admin()` clause
-- already covers write access to any booking, not just assigned/household
-- ones, so no RLS change is needed either.

alter table public.bookings add column if not exists admin_note text;

-- Same lesson 0019/0025 already paid for: a column must be named in the
-- UPDATE grant list or Postgres rejects the whole statement outright.
grant update (booking_status, symptom_brief, payment_proof_path, service_mode, assigned_to, admin_note)
  on public.bookings to authenticated;
