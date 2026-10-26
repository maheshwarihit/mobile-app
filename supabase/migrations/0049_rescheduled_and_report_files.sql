-- =====================================================================
-- VAgeWell Care — 0049 Rescheduled bookings; original lab report files
-- =====================================================================
-- 1. Rescheduling releases the old booking as 'cancelled' (there is no
--    separate status). Until now only the patient's own phone remembered it
--    was a reschedule, so staff and other devices saw "Cancelled". The time
--    of the reschedule is now stored on the booking itself.
-- 2. Bio Markers sends report pages (photos / PDFs) to the AI; only a small
--    picture of page 1 was kept. The original files are now kept in a
--    private bucket, readable by the household, the admin and the
--    household's assigned Care Givers (same rule as nutrition records, 0047).
--
-- Needs 0047 (can_view_folder). Run once in the Supabase SQL editor (safe to re-run).
-- =====================================================================

alter table public.bookings add column if not exists rescheduled_at timestamptz;

-- Only meaningful together with the release itself.
alter table public.bookings drop constraint if exists bookings_rescheduled_only_when_cancelled;
alter table public.bookings add constraint bookings_rescheduled_only_when_cancelled
  check (rescheduled_at is null or booking_status = 'cancelled');

-- ── Original lab report files ────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-report-files', 'lab-report-files', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Folder 1 = the account id of the household the report belongs to.
drop policy if exists lab_file_select on storage.objects;
create policy lab_file_select on storage.objects for select to authenticated
  using (bucket_id = 'lab-report-files' and public.can_view_folder((storage.foldername(name))[1]));
drop policy if exists lab_file_insert on storage.objects;
create policy lab_file_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lab-report-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists lab_file_update on storage.objects;
create policy lab_file_update on storage.objects for update to authenticated
  using (bucket_id = 'lab-report-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists lab_file_delete on storage.objects;
create policy lab_file_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lab-report-files' and (storage.foldername(name))[1] = auth.uid()::text);
