-- ============================================================================
-- VAgeWell Care — 0005 storage : admin-managed UPI payment QR (shown to patients)
-- A single object 'upi.png' in a PUBLIC bucket. Patients read it on the payment
-- screen; only admins can upload/replace it from the admin panel.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-qr', 'payment-qr', true,
  5242880,                                              -- 5 MB
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read (the QR is meant to be shown to everyone). Public buckets also serve
-- the object via the public URL, but keep an explicit SELECT policy for clarity.
create policy qr_public_read on storage.objects
  for select
  using (bucket_id = 'payment-qr');

-- Only admins may upload / replace / remove the QR.
create policy qr_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-qr' and public.is_admin());

create policy qr_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'payment-qr' and public.is_admin())
  with check (bucket_id = 'payment-qr' and public.is_admin());

create policy qr_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-qr' and public.is_admin());
