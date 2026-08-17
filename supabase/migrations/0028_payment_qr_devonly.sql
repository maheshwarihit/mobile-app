-- ============================================================================
-- 0028: payment-qr becomes developer-only to change — no in-app upload
-- ============================================================================
-- User asked for the QR-change ability removed from admin/leaf_node entirely
-- — only a developer with direct Supabase access (Storage dashboard or SQL)
-- should be able to update it going forward. Dropping the admin-write storage
-- policies enforces this at the database level, not just by removing the
-- upload button from AdminPaymentQrScreen (mobile) — a raw API call from an
-- admin account can no longer write to this bucket either. `qr_public_read`
-- is untouched: clients still need to see the QR on the Payment screen.

drop policy if exists qr_admin_insert on storage.objects;
drop policy if exists qr_admin_update on storage.objects;
drop policy if exists qr_admin_delete on storage.objects;
