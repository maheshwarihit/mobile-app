-- ============================================================================
-- 0022: profile photo upload
-- ============================================================================
-- User asked for a profile-photo option alongside the restored self-edit
-- profile screen. New public bucket (avatars are routinely public content,
-- unlike payment proofs/medical reports — same precedent as payment-qr) with
-- per-user write folders; a plain public URL is used for display, no signed
-- URL/TTL to manage.

alter table public.profiles add column if not exists avatar_path text;

-- Learned the hard way in 0019 (address): a column must be explicitly named
-- in the grant list or every UPDATE naming it is rejected outright,
-- regardless of RLS. Add avatar_path here rather than relying on a broader
-- grant that doesn't exist.
grant update (full_name, age, date_of_birth, gender, how_heard, wellness_note, address, avatar_path)
  on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos','profile-photos', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: `<user_id>/<timestamp>.<ext>`. Public bucket → no select
-- policy needed for read (object URLs are served directly); writes are
-- restricted to the owner's own folder or an ops account correcting it.
drop policy if exists avatar_insert on storage.objects;
create policy avatar_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists avatar_update on storage.objects;
create policy avatar_update on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists avatar_delete on storage.objects;
create policy avatar_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
