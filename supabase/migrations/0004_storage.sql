-- ============================================================================
-- VAgeWell Care — 0004 storage : private UPI payment-proof bucket (GO-5)
-- Path convention: {auth.uid()}/{booking_id}/{filename}
-- foldername(name)[1] = uploader uid, [2] = booking id → makes RLS enforceable.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs', 'payment-proofs', false,
  5242880,                                              -- 5 MB (GO-5)
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Patient uploads only under their own uid folder, and only for a booking they own.
create policy pay_proof_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] in
        (select id::text from public.bookings where account_id = auth.uid())
  );

-- Read: owner reads own; staff/admin read all (to verify).
create policy pay_proof_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

-- Update / delete: owner (re-upload after rejection) or staff.
create policy pay_proof_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

create policy pay_proof_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );
