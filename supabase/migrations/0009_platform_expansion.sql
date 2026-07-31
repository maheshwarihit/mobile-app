-- ============================================================================
-- VAgeWell Care — 0009 platform expansion
-- Adds: leaf_node role, household-linked family-member logins, a real booking
-- assignment pipeline (requested→approved→assigned→in_progress→report_uploaded
-- →completed, or cancelled), per-service pricing models (flat advance vs
-- per-day), and a staff/leaf-node report-upload system gated on admin review.
-- Assumes 0001–0008 already applied.
-- ============================================================================

-- ── ROLES: widen to include leaf_node ────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('patient','staff','admin','leaf_node'));

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin','leaf_node'));
$$;
-- is_admin() is unchanged — stays the sole full-oversight gate.

-- ── HOUSEHOLD LINKING: family members get their own login ───────────────────
alter table public.profiles       add column if not exists primary_account_id uuid references public.profiles(id);
alter table public.family_members add column if not exists linked_profile_id  uuid references public.profiles(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'family_members_linked_profile_id_key') then
    alter table public.family_members add constraint family_members_linked_profile_id_key unique (linked_profile_id);
  end if;
end $$;
create index if not exists idx_profiles_primary_account on public.profiles(primary_account_id);

-- Reusable "same household" check: the caller's own account, an account whose
-- primary is the caller, or the account that is the caller's own primary.
create or replace function public.in_household(p_account_id uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select p_account_id = auth.uid()
      or exists (select 1 from public.profiles where id = p_account_id and primary_account_id = auth.uid())
      or exists (select 1 from public.profiles where id = auth.uid() and primary_account_id = p_account_id);
$$;
revoke all on function public.in_household(uuid) from public, anon;
grant execute on function public.in_household(uuid) to authenticated;

-- handle_new_user(): after provisioning the profile, claim a matching
-- family_members slot if this phone was already registered as a dependent.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_age int; v_family_row public.family_members;
begin
  if coalesce(new.raw_user_meta_data->>'age','') ~ '^\d+$'
    then v_age := (new.raw_user_meta_data->>'age')::int; else v_age := null; end if;
  insert into public.profiles (id, role, phone, full_name, age, gender, how_heard, wellness_note)
  values (new.id, 'patient', new.phone,
          nullif(new.raw_user_meta_data->>'full_name',''), v_age,
          nullif(new.raw_user_meta_data->>'gender',''),
          coalesce(nullif(new.raw_user_meta_data->>'how_heard',''),'web_search'),
          nullif(new.raw_user_meta_data->>'wellness_note',''))
  on conflict (id) do nothing;

  -- Household auto-link: first family_members row with a matching, unclaimed
  -- contact_phone wins (documented limitation if the same number appears
  -- under multiple accounts).
  if new.phone is not null then
    select * into v_family_row from public.family_members
     where contact_phone = new.phone and linked_profile_id is null
     order by created_at asc limit 1;
    if found then
      update public.profiles set primary_account_id = v_family_row.account_id where id = new.id;
      update public.family_members set linked_profile_id = new.id where id = v_family_row.id;
    end if;
  end if;
  return new;
end; $$;

-- ── PRICING MODEL (services) ─────────────────────────────────────────────────
alter table public.services add column if not exists pricing_model text not null default 'per_day';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'services_pricing_model_check') then
    alter table public.services add constraint services_pricing_model_check
      check (pricing_model in ('per_day','flat_advance'));
  end if;
end $$;

update public.services set pricing_model = 'flat_advance', price_per_day = 2000, updated_at = now()
 where name in ('Nutrition','Physio Therapy');
update public.services set pricing_model = 'per_day', updated_at = now()
 where name in ('Para-Medical','Mental Wellbeing');

-- ── BOOKING PIPELINE ──────────────────────────────────────────────────────────
alter table public.bookings add column if not exists service_mode  text;
alter table public.bookings add column if not exists assigned_to   uuid references public.profiles(id);
alter table public.bookings add column if not exists pricing_model text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_service_mode_check') then
    alter table public.bookings add constraint bookings_service_mode_check
      check (service_mode is null or service_mode in ('clinic','home_care'));
  end if;
end $$;
create index if not exists idx_bookings_assigned_to on public.bookings(assigned_to);

-- total_amount can no longer be a generated column: the amount now depends on
-- the snapshotted pricing_model (flat vs per-day), not a fixed formula.
alter table public.bookings alter column total_amount drop expression if exists;

-- Chicken-and-egg fix: the OLD constraint rejects the new values
-- ('requested' etc.) but the NEW constraint rejects the still-present old
-- ones ('open'/'closed') until they're converted. `not valid` adds the new
-- constraint (enforced for all writes from this point on) WITHOUT scanning
-- existing rows, so the backfill below can convert the old values first;
-- `validate constraint` afterward confirms the whole table is clean. Also
-- disable the assignment-pipeline update guard around the conversion itself
-- — on a re-run of this migration (or of install_all.sql, which bundles it),
-- that trigger already exists and has no rule for a bare 'open'/'closed'
-- transition, so it raises "illegal booking_status transition" and aborts
-- the rest of the script.
alter table public.bookings drop constraint if exists bookings_booking_status_check;
alter table public.bookings add constraint bookings_booking_status_check
  check (booking_status in ('requested','approved','assigned','in_progress','report_uploaded','completed','cancelled'))
  not valid;
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'tg_bookings_before_update' and tgrelid = 'public.bookings'::regclass) then
    execute 'alter table public.bookings disable trigger tg_bookings_before_update';
  end if;
end $$;
update public.bookings set booking_status = 'requested' where booking_status = 'open';
update public.bookings set booking_status = 'completed' where booking_status = 'closed';
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'tg_bookings_before_update' and tgrelid = 'public.bookings'::regclass) then
    execute 'alter table public.bookings enable trigger tg_bookings_before_update';
  end if;
end $$;
alter table public.bookings validate constraint bookings_booking_status_check;

create or replace function public.tg_booking_snapshot() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_price numeric(10,2); v_name text; v_active boolean; v_pricing_model text;
begin
  new.account_id := auth.uid();
  if not exists (select 1 from public.profiles
                 where id = auth.uid() and full_name is not null and length(trim(full_name)) > 0) then
    raise exception 'profile incomplete: add your name before booking' using errcode = '42501';
  end if;
  if new.family_member_id is not null then
    if not exists (select 1 from public.family_members
                   where id = new.family_member_id and account_id = auth.uid()) then
      raise exception 'family_member does not belong to caller' using errcode = '42501';
    end if;
  end if;
  select price_per_day, name, active, pricing_model into v_price, v_name, v_active, v_pricing_model
  from public.services where id = new.service_id;
  if not found or not v_active then raise exception 'service unavailable' using errcode = '23503'; end if;
  new.price_per_day  := v_price;
  new.service_name   := v_name;
  new.pricing_model  := v_pricing_model;
  new.total_amount   := case when v_pricing_model = 'flat_advance' then v_price else new.num_days * v_price end;
  if new.payment_method = 'direct' then
    new.payment_status := 'pay_at_visit';
  else
    new.payment_status := case when new.payment_proof_path is not null
                               then 'pending_verification' else 'pending' end;
  end if;
  new.booking_status := 'requested';
  new.service_mode    := null;
  new.assigned_to      := null;
  return new;
end; $$;

create or replace function public.tg_booking_update_guard() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.account_id is distinct from old.account_id
  or new.family_member_id is distinct from old.family_member_id
  or new.service_id is distinct from old.service_id
  or new.service_name is distinct from old.service_name
  or new.price_per_day is distinct from old.price_per_day
  or new.pricing_model is distinct from old.pricing_model
  or new.num_days is distinct from old.num_days
  or new.start_date is distinct from old.start_date
  or new.time_slot is distinct from old.time_slot
  or new.payment_method is distinct from old.payment_method then
    raise exception 'immutable booking field changed' using errcode = '42501';
  end if;

  if new.payment_proof_path is distinct from old.payment_proof_path and old.payment_status = 'paid' then
    raise exception 'cannot change payment proof after settlement' using errcode = '42501';
  end if;
  if new.payment_proof_path is not null and old.payment_proof_path is null
     and old.payment_status = 'pending' and new.payment_method = 'online' then
    new.payment_status := 'pending_verification';
  end if;
  if new.payment_status is distinct from old.payment_status then
    if public.is_staff() then null;
    elsif old.payment_status = 'pending' and new.payment_status = 'pending_verification' then null;
    else raise exception 'illegal payment_status transition' using errcode = '42501'; end if;
  end if;

  -- Assignment fields: admin-only, and service_mode must accompany/precede assigned_to.
  if new.service_mode is distinct from old.service_mode and not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is not null then
      if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
      if new.service_mode is null then
        raise exception 'service_mode must be set before assignment' using errcode = '23514';
      end if;
      if new.service_mode = 'clinic'
         and not exists (select 1 from public.profiles where id = new.assigned_to and role = 'staff') then
        raise exception 'assigned_to must be a staff member for clinic visits' using errcode = '23514';
      end if;
      if new.service_mode = 'home_care'
         and not exists (select 1 from public.profiles where id = new.assigned_to and role = 'leaf_node') then
        raise exception 'assigned_to must be a leaf_node member for home care visits' using errcode = '23514';
      end if;
    elsif not public.is_admin() then
      raise exception 'admin only' using errcode = '42501';
    end if;
  end if;

  -- Booking status pipeline.
  if new.booking_status is distinct from old.booking_status then
    if new.booking_status = 'cancelled' then
      if public.is_staff() then
        if old.booking_status = 'completed' then
          raise exception 'cannot cancel a completed booking' using errcode = '42501';
        end if;
      elsif not (old.booking_status in ('requested','approved') and old.account_id = auth.uid()) then
        raise exception 'illegal booking_status transition' using errcode = '42501';
      end if;
    elsif old.booking_status = 'requested' and new.booking_status in ('approved','assigned') then
      if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
    elsif old.booking_status = 'approved' and new.booking_status = 'assigned' then
      if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
    elsif old.booking_status = 'assigned' and new.booking_status = 'in_progress' then
      if not (auth.uid() = old.assigned_to or public.is_admin()) then
        raise exception 'assigned member or admin only' using errcode = '42501'; end if;
    elsif old.booking_status = 'in_progress' and new.booking_status in ('report_uploaded','completed') then
      if not (auth.uid() = old.assigned_to or public.is_admin()) then
        raise exception 'assigned member or admin only' using errcode = '42501'; end if;
    elsif old.booking_status = 'report_uploaded' and new.booking_status = 'completed' then
      if not (auth.uid() = old.assigned_to or public.is_admin()) then
        raise exception 'assigned member or admin only' using errcode = '42501'; end if;
    else
      raise exception 'illegal booking_status transition' using errcode = '42501';
    end if;
  end if;

  return new;
end; $$;

-- ── REPORT UPLOADS ────────────────────────────────────────────────────────────
create table if not exists public.report_uploads (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  uploaded_by  uuid not null references public.profiles(id) on delete restrict,
  report_type  text not null check (report_type in ('medical_report','image','prescription','pdf')),
  storage_path text not null,
  note         text,
  reviewed     boolean not null default false,
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_report_uploads_booking on public.report_uploads(booking_id);
drop trigger if exists tg_report_uploads_updated_at on public.report_uploads;
create trigger tg_report_uploads_updated_at before update on public.report_uploads
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_report_uploaded_stamp() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.uploaded_by := auth.uid();
  return new;
end; $$;
drop trigger if exists tg_report_uploads_before_insert on public.report_uploads;
create trigger tg_report_uploads_before_insert before insert on public.report_uploads
  for each row execute function public.tg_report_uploaded_stamp();

-- Advances the parent booking the moment a report lands (only if it's still
-- in_progress — idempotent against multiple report uploads per visit).
create or replace function public.tg_report_advance_booking() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.bookings set booking_status = 'report_uploaded'
   where id = new.booking_id and booking_status = 'in_progress';
  return new;
end; $$;
drop trigger if exists tg_report_uploads_after_insert on public.report_uploads;
create trigger tg_report_uploads_after_insert after insert on public.report_uploads
  for each row execute function public.tg_report_advance_booking();

create or replace function public.review_report(p_report uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.report_uploads
     set reviewed = true, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_report;
  if not found then raise exception 'report not found' using errcode = 'P0001'; end if;
end; $$;
revoke all on function public.review_report(uuid) from public, anon;
grant execute on function public.review_report(uuid) to authenticated;

alter table public.report_uploads enable row level security;
alter table public.report_uploads force row level security;
grant select, insert on public.report_uploads to authenticated;

drop policy if exists report_insert on public.report_uploads;
create policy report_insert on public.report_uploads for insert to authenticated
  with check (public.is_staff());
drop policy if exists report_select on public.report_uploads;
create policy report_select on public.report_uploads for select to authenticated
  using (
    public.is_staff()
    or (reviewed and exists (
      select 1 from public.bookings b where b.id = report_uploads.booking_id and public.in_household(b.account_id)
    ))
  );

-- ── set_user_role(): widen to leaf_node ──────────────────────────────────────
create or replace function public.set_user_role(p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_role not in ('patient','staff','admin','leaf_node') then raise exception 'invalid role'; end if;
  update public.profiles set role = p_role where id = p_user;
end; $$;

-- ── RLS: household + assignment scoping ─────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or public.in_household(id));

drop policy if exists fam_select on public.family_members;
create policy fam_select on public.family_members for select to authenticated
  using (public.in_household(account_id) or public.is_staff());
drop policy if exists fam_insert on public.family_members;
create policy fam_insert on public.family_members for insert to authenticated
  with check (public.in_household(account_id) or public.is_staff());
drop policy if exists fam_update on public.family_members;
create policy fam_update on public.family_members for update to authenticated
  using (public.in_household(account_id) or public.is_staff())
  with check (public.in_household(account_id) or public.is_staff());
drop policy if exists fam_delete on public.family_members;
create policy fam_delete on public.family_members for delete to authenticated
  using (public.in_household(account_id) or public.is_staff());

drop policy if exists bk_select on public.bookings;
create policy bk_select on public.bookings for select to authenticated
  using (
    public.in_household(account_id)
    or public.is_admin()
    or (public.is_staff() and assigned_to = auth.uid())
  );
drop policy if exists bk_update on public.bookings;
create policy bk_update on public.bookings for update to authenticated
  using (
    public.in_household(account_id)
    or public.is_admin()
    or (public.is_staff() and assigned_to = auth.uid())
  )
  with check (
    public.in_household(account_id)
    or public.is_admin()
    or (public.is_staff() and assigned_to = auth.uid())
  );

drop policy if exists clin_select on public.clinical_records;
create policy clin_select on public.clinical_records for select to authenticated
  using (
    public.in_household(profile_id)
    or public.is_staff()
    or family_member_id in (select id from public.family_members where public.in_household(account_id))
  );

-- ── COLUMN GRANTS: admin needs to set the new assignment fields ─────────────
grant update (booking_status, symptom_brief, payment_proof_path, service_mode, assigned_to)
  on public.bookings to authenticated;

-- ── STORAGE: medical-reports bucket (private) ───────────────────────────────
-- Path convention: `<booking_id>/<uploaded_by>/<timestamp>.<ext>` — mirrors
-- payment-proofs' `<uid>/<booking_id>/...` shape but keyed by booking first,
-- since report visibility is booking-scoped (via report_uploads RLS), not
-- uploader-scoped.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-reports','medical-reports', false, 10485760,
        array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists report_file_insert on storage.objects;
create policy report_file_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'medical-reports' and public.is_staff());
drop policy if exists report_file_select on storage.objects;
create policy report_file_select on storage.objects for select to authenticated
  using (
    bucket_id = 'medical-reports'
    and (
      public.is_staff()
      or exists (
        select 1 from public.report_uploads r
        join public.bookings b on b.id = r.booking_id
        where r.storage_path = storage.objects.name and r.reviewed and public.in_household(b.account_id)
      )
    )
  );
