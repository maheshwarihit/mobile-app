-- ============================================================================
-- 0016: widen bk_select so any staff/leaf_node/admin sees every booking
-- ============================================================================
-- User decision: searching a patient on the Live Sheet should surface that
-- patient's full history for any ops user, not just an admin or the specific
-- staff/leaf_node member a visit happens to be assigned to. `bk_select` was
-- the one outlier still scoping plain staff/leaf_node to
-- `assigned_to = auth.uid()` — every other RLS policy in this schema
-- (clin_select, report_select, fam_select, svc_select) already grants any
-- is_staff() caller full visibility; this brings bookings in line with that
-- existing precedent.
--
-- Deliberately NOT touching `bk_update`: staff/leaf_node can now SEE every
-- booking, but can still only ACT on (start/complete/upload for) the ones
-- actually assigned to them — same split already used for reports (view all,
-- upload/release still gated). `useMyAssignedBookings()` (web My Visits) is
-- unaffected by this either way — it already filters explicitly to
-- `assigned_to = auth.uid()` client-side on top of RLS, so widening the
-- policy doesn't change what that page shows.

drop policy if exists bk_select on public.bookings;
create policy bk_select on public.bookings for select to authenticated
  using (public.in_household(account_id) or public.is_staff());
