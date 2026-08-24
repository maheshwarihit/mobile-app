-- Lets a caregiver remove a report they uploaded by mistake, before an admin
-- has released it to the customer (once released, it's out — the customer
-- may have already seen it, so it stays as a record). Admin can also delete
-- any report, for general cleanup. report_uploads previously had no delete
-- grant at all — this was a deliberate lock-down (see the 2026-07-31 "Reports
-- as a real table" round's confirmation), now relaxed by exactly this much.

grant delete on public.report_uploads to authenticated;

drop policy if exists report_delete on public.report_uploads;
create policy report_delete on public.report_uploads for delete to authenticated
  using ((uploaded_by = auth.uid() and not reviewed) or public.is_admin());
