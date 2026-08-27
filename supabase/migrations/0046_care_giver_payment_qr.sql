-- ============================================================================
-- 0046: Care Giver's own payment QR (self-uploaded, shown on their own Profile)
-- ============================================================================
-- Booking no longer collects payment up front (see the 2026-08-21 "no
-- payment at booking" round) — the Care Giver collects payment directly from
-- the client at the home visit. This gives each Care Giver their own UPI QR
-- code (e.g. exported from their own UPI app) to show the client's phone
-- camera on-site. Deliberately separate from PAYMENT_QR_BUCKET/`payment-qr`
-- (0005, made read-only in 0028) — that bucket is one fixed admin-owned QR
-- for the (now-removed) in-app online-payment flow; this is per-account,
-- self-uploaded, and shown only on that Care Giver's own device.

alter table public.profiles add column if not exists payment_qr_path text;

-- Learned in 0019/0022: a column must be explicitly named in the grant list
-- or every UPDATE naming it is rejected outright, regardless of RLS. Added
-- up front here instead of repeating that discovery.
grant update (full_name, age, date_of_birth, gender, how_heard, wellness_note, address, avatar_path, emp_id, viewed_by_admin_at, display_name, payment_qr_path)
  on public.profiles to authenticated;

-- care-giver-payment-qr (public bucket, same precedent as profile-photos —
-- a QR code is meant to be shown/scanned, not kept private). Path
-- convention: `<user_id>/<timestamp>.<ext>`. No select policy needed for
-- read — a public bucket serves object URLs directly. INSERT policy is
-- bucket_id-only from the start (0023 already found that a path-ownership
-- check on INSERT rejects real uploads for this exact bucket shape on
-- profile-photos; not repeating that dead end here).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('care-giver-payment-qr','care-giver-payment-qr', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists cg_qr_insert on storage.objects;
create policy cg_qr_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'care-giver-payment-qr');
drop policy if exists cg_qr_update on storage.objects;
create policy cg_qr_update on storage.objects for update to authenticated
  using (bucket_id = 'care-giver-payment-qr'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists cg_qr_delete on storage.objects;
create policy cg_qr_delete on storage.objects for delete to authenticated
  using (bucket_id = 'care-giver-payment-qr'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
