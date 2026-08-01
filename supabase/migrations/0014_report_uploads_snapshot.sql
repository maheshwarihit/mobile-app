-- ============================================================================
-- 0014: snapshot patient_name/service_name onto report_uploads
-- ============================================================================
-- The "Reports" surface (admin's /reports, staff/leaf_node's My Visits "View
-- Report") needs to show who a report belongs to and when it was uploaded.
-- Resolving that client-side by joining against `bookings` breaks for plain
-- staff/leaf_node once the report list is widened beyond "just my assigned
-- bookings": `bk_select` RLS scopes them to `assigned_to = auth.uid()`, but
-- `report_select` RLS already grants any is_staff() caller every report
-- regardless of who it's assigned to — so a staff member could see a report
-- exists but never resolve whose it was. Snapshotting the names onto the
-- report row itself at upload time (same pattern already used for
-- bookings.service_name/price_per_day) sidesteps that gap entirely and
-- matches every other "freeze it at write time" decision already made in
-- this schema.

alter table public.report_uploads add column if not exists patient_name text;
alter table public.report_uploads add column if not exists service_name text;

create or replace function public.tg_report_uploaded_stamp() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_service_name text; v_account_id uuid; v_family_member_id uuid; v_patient_name text;
begin
  new.uploaded_by := auth.uid();
  select b.service_name, b.account_id, b.family_member_id
    into v_service_name, v_account_id, v_family_member_id
  from public.bookings b where b.id = new.booking_id;
  new.service_name := v_service_name;
  if v_family_member_id is not null then
    select full_name into v_patient_name from public.family_members where id = v_family_member_id;
  else
    select full_name into v_patient_name from public.profiles where id = v_account_id;
  end if;
  new.patient_name := coalesce(v_patient_name, 'Patient');
  return new;
end; $$;

-- Backfill existing rows (repair path — safe to re-run, only touches rows
-- that are still missing either snapshot column).
update public.report_uploads r
set service_name = b.service_name,
    patient_name = coalesce(fm.full_name, p.full_name, 'Patient')
from public.bookings b
left join public.family_members fm on fm.id = b.family_member_id
left join public.profiles p on p.id = b.account_id
where r.booking_id = b.id
  and (r.service_name is null or r.patient_name is null);
