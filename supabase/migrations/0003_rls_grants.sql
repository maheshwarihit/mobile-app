-- ============================================================================
-- VAgeWell Care — 0003 column privileges + RLS
-- Two layers: (1) column GRANT/REVOKE removes write access to sensitive columns
-- from every logged-in user (role, pricing, payment_status) so no crafted request
-- can touch them; (2) RLS restricts which ROWS each user sees/edits.
-- ============================================================================

-- ── Column privileges (anti-tamper) ─────────────────────────────────────────
-- profiles: patient edits ONLY biographical fields. role/id/phone excluded →
-- not settable by any client UPDATE (R4.2, no self-escalation).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant  select on public.profiles to authenticated;
grant  update (full_name, age, date_of_birth, gender, how_heard, wellness_note)
       on public.profiles to authenticated;

-- bookings: client authors request fields only. account_id/pricing/payment_status
-- are server-authored (triggers/RPCs) and frozen.
revoke insert, update, delete on public.bookings from anon, authenticated;
grant  select on public.bookings to authenticated;
grant  insert (service_id, family_member_id, num_days, start_date, time_slot,
               symptom_brief, payment_method, payment_proof_path)
       on public.bookings to authenticated;
grant  update (booking_status, symptom_brief, payment_proof_path)
       on public.bookings to authenticated;

-- family_members / services / clinical_records: RLS gates them; grants are broad.
grant select, insert, update, delete on public.family_members   to authenticated;
grant select, insert, update, delete on public.services         to authenticated;
grant select, insert, update, delete on public.clinical_records to authenticated;

-- ── Enable + force RLS on every table (default-deny) ────────────────────────
alter table public.profiles         enable row level security;
alter table public.family_members   enable row level security;
alter table public.services         enable row level security;
alter table public.bookings         enable row level security;
alter table public.clinical_records enable row level security;
alter table public.profiles         force row level security;
alter table public.family_members   force row level security;
alter table public.services         force row level security;
alter table public.bookings         force row level security;
alter table public.clinical_records force row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy profiles_update on public.profiles
  for update to authenticated
  using      (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());
-- role is still unchangeable here (no column-UPDATE grant); only set_user_role() moves it.

-- ── family_members (R3.2 / R4.3) ────────────────────────────────────────────
create policy fam_select on public.family_members
  for select to authenticated using (account_id = auth.uid() or public.is_staff());
create policy fam_insert on public.family_members
  for insert to authenticated with check (account_id = auth.uid() or public.is_staff());
create policy fam_update on public.family_members
  for update to authenticated
  using (account_id = auth.uid() or public.is_staff())
  with check (account_id = auth.uid() or public.is_staff());
create policy fam_delete on public.family_members
  for delete to authenticated using (account_id = auth.uid() or public.is_staff());

-- ── services (everyone reads active; admin manages catalog) ─────────────────
create policy svc_select on public.services
  for select to authenticated using (active = true or public.is_staff());
create policy svc_write_admin on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── bookings (R4.3 isolation; R3.3 quarantine enforced by triggers) ─────────
create policy bk_select on public.bookings
  for select to authenticated using (account_id = auth.uid() or public.is_staff());
create policy bk_insert on public.bookings
  for insert to authenticated with check (account_id = auth.uid());
create policy bk_update on public.bookings
  for update to authenticated
  using (account_id = auth.uid() or public.is_staff())
  with check (account_id = auth.uid() or public.is_staff());
-- no delete policy → bookings are cancelled via status, never hard-deleted.

-- ── clinical_records (R4.2 / GR-6: patient read-only, staff read/write) ─────
create policy clin_select on public.clinical_records
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_staff()
    or family_member_id in (select id from public.family_members where account_id = auth.uid())
  );
create policy clin_write_staff on public.clinical_records
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- patients have NO write policy → recording/altering vitals is structurally impossible.
