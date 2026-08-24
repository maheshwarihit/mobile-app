-- Lets the uploader rename their own not-yet-released report's file name
-- (fixing a typo or unclear name), or admin rename any report — mirrors the
-- same ownership rule 0041's delete policy already uses. report_uploads
-- previously had no update grant at all.

grant update (file_name) on public.report_uploads to authenticated;

drop policy if exists report_update on public.report_uploads;
create policy report_update on public.report_uploads for update to authenticated
  using ((uploaded_by = auth.uid() and not reviewed) or public.is_admin())
  with check ((uploaded_by = auth.uid() and not reviewed) or public.is_admin());
