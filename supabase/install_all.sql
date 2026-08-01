-- ============================================================================
-- VAgeWell Care — CONSOLIDATED "install everything" (idempotent, safe to re-run)
-- Paste into the hosted project's SQL Editor and Run. Combines migrations
-- 0001–0015. Fixes a project that was set up piecemeal, and also converges an
-- already-migrated project onto the latest shape.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── TABLES ──────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  role               text not null default 'patient' check (role in ('patient','staff','admin','leaf_node')),
  full_name          text,
  phone              text,
  age                int  check (age is null or (age >= 0 and age <= 150)),
  gender             text check (gender is null or gender in ('male','female','other','prefer_not_to_say')),
  date_of_birth      date,
  how_heard          text not null default 'web_search'
                       check (how_heard in ('web_search','referral','social_media','family_friend','advertisement','other')),
  wellness_note      text,
  primary_account_id uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- Repair path: widen role + add household column on a table that predates 0009.
alter table public.profiles add column if not exists primary_account_id uuid references public.profiles(id);
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('patient','staff','admin','leaf_node'));
-- Repair path: address on a table that predates 0011.
alter table public.profiles add column if not exists address text;

create table if not exists public.family_members (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references public.profiles(id) on delete cascade,
  full_name         text not null,
  age               int  check (age is null or (age >= 0 and age <= 150)),
  date_of_birth     date,
  gender            text check (gender is null or gender in ('male','female','other','prefer_not_to_say')),
  relationship      text not null
                      check (relationship in ('spouse','parent','child','sibling','grandparent','grandchild','other')),
  contact_phone     text,
  linked_profile_id uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.family_members add column if not exists linked_profile_id uuid references public.profiles(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'family_members_linked_profile_id_key') then
    alter table public.family_members add constraint family_members_linked_profile_id_key unique (linked_profile_id);
  end if;
end $$;

create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  description   text,
  price_per_day numeric(10,2) not null check (price_per_day >= 0),
  pricing_model text not null default 'per_day' check (pricing_model in ('per_day','flat_advance')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.services add column if not exists pricing_model text not null default 'per_day';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'services_pricing_model_check') then
    alter table public.services add constraint services_pricing_model_check check (pricing_model in ('per_day','flat_advance'));
  end if;
end $$;

create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.profiles(id) on delete cascade,
  family_member_id   uuid references public.family_members(id) on delete set null,
  service_id         uuid not null references public.services(id) on delete restrict,
  service_name       text not null,
  price_per_day      numeric(10,2) not null check (price_per_day >= 0),
  pricing_model      text,
  num_days           int not null check (num_days between 1 and 60),
  total_amount       numeric(12,2),
  start_date         date not null,
  time_slot          time not null
                       check (extract(minute from time_slot) in (0,15,30,45)
                              and extract(second from time_slot) = 0
                              and time_slot between '06:00' and '21:00'),
  symptom_brief      text,
  payment_method     text not null check (payment_method in ('direct','online')),
  payment_status     text not null
                       check (payment_status in ('pending','pending_verification','paid','pay_at_visit')),
  payment_note       text,
  payment_proof_path text,
  service_mode       text check (service_mode is null or service_mode in ('clinic','home_care')),
  assigned_to        uuid references public.profiles(id),
  booking_status     text not null default 'requested'
                       check (booking_status in ('requested','approved','assigned','in_progress','report_uploaded','completed','cancelled')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint chk_method_status check (
    (payment_method = 'direct' and payment_status in ('pay_at_visit','paid'))
    or (payment_method = 'online' and payment_status in ('pending','pending_verification','paid'))
  )
);
-- Repair path for a bookings table created before 0009.
alter table public.bookings add column if not exists pricing_model text;
alter table public.bookings add column if not exists service_mode  text;
alter table public.bookings add column if not exists assigned_to   uuid references public.profiles(id);
alter table public.bookings alter column total_amount drop expression if exists;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_service_mode_check') then
    alter table public.bookings add constraint bookings_service_mode_check
      check (service_mode is null or service_mode in ('clinic','home_care'));
  end if;
end $$;
-- Chicken-and-egg fix: the OLD constraint rejects the new values ('requested'
-- etc.) but the NEW constraint rejects the still-present old ones ('open'/
-- 'closed') until they're converted. `not valid` adds the new constraint
-- (enforced for all writes from this point on) WITHOUT scanning existing rows,
-- so the backfill below can convert the old values first; `validate
-- constraint` afterward confirms the whole table is clean. Also disable the
-- assignment-pipeline update guard around the conversion itself — that
-- trigger has no rule for a bare 'open'/'closed' transition and would raise
-- "illegal booking_status transition" the moment it already exists on the
-- table (i.e. every re-run after the first), aborting the entire script
-- right here and silently skipping everything after — including the
-- services reseed and the booking_requests table further down.
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

create table if not exists public.clinical_records (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid references public.profiles(id) on delete cascade,
  family_member_id   uuid references public.family_members(id) on delete cascade,
  recorded_by        uuid not null references public.profiles(id) on delete restrict,
  systolic           int  check (systolic  is null or systolic  between 40 and 300),
  diastolic          int  check (diastolic is null or diastolic between 20 and 200),
  blood_glucose      numeric(5,1) check (blood_glucose is null or blood_glucose >= 0),
  spo2               int  check (spo2 is null or spo2 between 0 and 100),
  blood_group        text check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  medical_conditions text,
  note               text,
  recorded_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint chk_one_subject check ((profile_id is not null)::int + (family_member_id is not null)::int = 1)
);

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
  patient_name text,
  service_name text,
  file_name    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Repair path: snapshot columns on a table that predates 0014.
alter table public.report_uploads add column if not exists patient_name text;
alter table public.report_uploads add column if not exists service_name text;
-- Repair path: original filename on a table that predates 0015.
alter table public.report_uploads add column if not exists file_name text;

create index if not exists idx_profiles_role            on public.profiles(role);
create index if not exists idx_profiles_primary_account on public.profiles(primary_account_id);
create index if not exists idx_family_members_account   on public.family_members(account_id);
create index if not exists idx_services_active          on public.services(active);
create index if not exists idx_bookings_account         on public.bookings(account_id);
create index if not exists idx_bookings_assigned_to     on public.bookings(assigned_to);
create index if not exists idx_bookings_created_at      on public.bookings(created_at desc);
create index if not exists idx_clinical_profile         on public.clinical_records(profile_id);
create index if not exists idx_clinical_family_member   on public.clinical_records(family_member_id);
create index if not exists idx_report_uploads_booking   on public.report_uploads(booking_id);

-- ── ROLE HELPERS ────────────────────────────────────────────────────────────
-- "Staff" now means any operational role (staff/leaf_node/admin) — the shared
-- elevated-access boundary. is_admin() stays the sole full-oversight gate.
create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin','leaf_node')); $$;
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- "Same household": the caller's own account, an account whose primary is the
-- caller, or the account that is the caller's own primary. Backs family-member
-- logins seeing/being seen by the account that manages them.
create or replace function public.in_household(p_account_id uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select p_account_id = auth.uid()
      or exists (select 1 from public.profiles where id = p_account_id and primary_account_id = auth.uid())
      or exists (select 1 from public.profiles where id = auth.uid() and primary_account_id = p_account_id); $$;
revoke all on function public.in_household(uuid) from public, anon;
grant execute on function public.in_household(uuid) to authenticated;

-- ── updated_at STAMPER ──────────────────────────────────────────────────────
create or replace function public.tg_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists tg_profiles_updated_at        on public.profiles;
drop trigger if exists tg_family_members_updated_at  on public.family_members;
drop trigger if exists tg_services_updated_at        on public.services;
drop trigger if exists tg_bookings_updated_at        on public.bookings;
drop trigger if exists tg_clinical_updated_at        on public.clinical_records;
drop trigger if exists tg_report_uploads_updated_at  on public.report_uploads;
create trigger tg_profiles_updated_at       before update on public.profiles         for each row execute function public.tg_set_updated_at();
create trigger tg_family_members_updated_at before update on public.family_members   for each row execute function public.tg_set_updated_at();
create trigger tg_services_updated_at       before update on public.services         for each row execute function public.tg_set_updated_at();
create trigger tg_bookings_updated_at       before update on public.bookings         for each row execute function public.tg_set_updated_at();
create trigger tg_clinical_updated_at       before update on public.clinical_records for each row execute function public.tg_set_updated_at();
create trigger tg_report_uploads_updated_at before update on public.report_uploads   for each row execute function public.tg_set_updated_at();

-- ── AUTO-PROVISION PROFILE ON SIGNUP (+ household auto-link) ────────────────
-- `requested_role` (0013): read from client-supplied signup metadata so the
-- web staff portal's Register page can let a brand-new number self-select
-- Staff/Admin/Leaf Node immediately, no admin approval step (explicit user
-- decision, accepting that any signup — not just the web UI — could set
-- this field; the mobile Register screen never sends it, so patient signups
-- are unaffected in practice). Only fires on account CREATION, so an
-- existing account has no way to use this path to escalate itself later.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_age int; v_family_row public.family_members; v_role text;
begin
  if coalesce(new.raw_user_meta_data->>'age','') ~ '^\d+$'
    then v_age := (new.raw_user_meta_data->>'age')::int; else v_age := null; end if;
  v_role := nullif(new.raw_user_meta_data->>'requested_role','');
  if v_role is null or v_role not in ('staff','admin','leaf_node') then
    v_role := 'patient';
  end if;
  insert into public.profiles (id, role, phone, full_name, age, gender, address, how_heard, wellness_note)
  values (new.id, v_role, new.phone,
          nullif(new.raw_user_meta_data->>'full_name',''), v_age,
          nullif(new.raw_user_meta_data->>'gender',''),
          nullif(new.raw_user_meta_data->>'address',''),
          coalesce(nullif(new.raw_user_meta_data->>'how_heard',''),'web_search'),
          nullif(new.raw_user_meta_data->>'wellness_note',''))
  on conflict (id) do nothing;

  -- First unclaimed family_members row with a matching contact_phone wins
  -- (documented limitation if the same number appears under multiple accounts).
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
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill a profile for any existing user who has none (won't change existing roles)
insert into public.profiles (id, role, phone, full_name)
select u.id, 'patient', u.phone, nullif(u.raw_user_meta_data->>'full_name','')
from auth.users u left join public.profiles p on p.id = u.id
where p.id is null;

-- ── BOOKING SNAPSHOT ON INSERT ──────────────────────────────────────────────
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
  if new.service_mode is null or new.service_mode not in ('clinic','home_care') then
    raise exception 'choose a visit type (clinic or home care)' using errcode = '23514';
  end if;
  select price_per_day, name, active, pricing_model into v_price, v_name, v_active, v_pricing_model
  from public.services where id = new.service_id;
  if not found or not v_active then raise exception 'service unavailable' using errcode = '23503'; end if;
  new.price_per_day := v_price;
  new.service_name  := v_name;
  new.pricing_model := v_pricing_model;
  new.total_amount  := case when v_pricing_model = 'flat_advance' then v_price else new.num_days * v_price end;
  if new.payment_method = 'direct' then
    new.payment_status := 'pay_at_visit';
  else
    new.payment_status := case when new.payment_proof_path is not null
                               then 'pending_verification' else 'pending' end;
  end if;
  new.booking_status := 'requested';
  -- service_mode (0012): left as the customer's choice, validated above — no
  -- longer forced to null for admin to decide later at approval time.
  new.assigned_to    := null;
  return new;
end; $$;
drop trigger if exists tg_bookings_before_insert on public.bookings;
create trigger tg_bookings_before_insert before insert on public.bookings
  for each row execute function public.tg_booking_snapshot();

-- ── BOOKING UPDATE GUARD (assignment pipeline) ──────────────────────────────
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
drop trigger if exists tg_bookings_before_update on public.bookings;
create trigger tg_bookings_before_update before update on public.bookings
  for each row execute function public.tg_booking_update_guard();

-- ── CLINICAL: stamp acting staff ────────────────────────────────────────────
create or replace function public.tg_clinical_before_write() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin new.recorded_by := auth.uid(); return new; end; $$;
drop trigger if exists tg_clinical_before_insert on public.clinical_records;
create trigger tg_clinical_before_insert before insert on public.clinical_records
  for each row execute function public.tg_clinical_before_write();

-- ── REPORT UPLOADS: stamp uploader, auto-advance the booking ────────────────
-- patient_name/service_name (0014): snapshotted here, not resolved later via
-- a join, because report_select RLS grants any is_staff() caller every
-- report regardless of who it's assigned to, but bk_select scopes plain
-- staff/leaf_node to their own assigned bookings — a join against bookings
-- would silently fail to resolve the name for a report outside that scope.
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
drop trigger if exists tg_report_uploads_before_insert on public.report_uploads;
create trigger tg_report_uploads_before_insert before insert on public.report_uploads
  for each row execute function public.tg_report_uploaded_stamp();

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

-- ── PAYMENT / REPORT / ROLE RPCs ─────────────────────────────────────────────
-- Cancelled bookings are out of the payment workflow entirely (mirrors 0008).
create or replace function public.verify_payment(p_booking uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if exists (select 1 from public.bookings where id = p_booking and booking_status = 'cancelled') then
    raise exception 'booking is cancelled — payment cannot be verified' using errcode = 'P0001';
  end if;
  update public.bookings set payment_status = 'paid', payment_note = null
   where id = p_booking and payment_status in ('pending_verification','pay_at_visit')
     and booking_status <> 'cancelled';
  if not found then raise exception 'booking not in a verifiable state' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.reject_payment(p_booking uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if exists (select 1 from public.bookings where id = p_booking and booking_status = 'cancelled') then
    raise exception 'booking is cancelled — payment cannot be rejected' using errcode = 'P0001';
  end if;
  update public.bookings
     set payment_status = 'pending',
         payment_note = coalesce(nullif(p_reason,''), 'Rejected — please re-upload a valid proof.'),
         payment_proof_path = null
   where id = p_booking and payment_status = 'pending_verification'
     and booking_status <> 'cancelled';
  if not found then raise exception 'booking not awaiting verification' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.review_report(p_report uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.report_uploads set reviewed = true, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_report;
  if not found then raise exception 'report not found' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.set_user_role(p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_role not in ('patient','staff','admin','leaf_node') then raise exception 'invalid role'; end if;
  update public.profiles set role = p_role where id = p_user;
end; $$;

revoke all on function public.verify_payment(uuid)       from public, anon;
revoke all on function public.reject_payment(uuid, text) from public, anon;
revoke all on function public.review_report(uuid)        from public, anon;
revoke all on function public.set_user_role(uuid, text)  from public, anon;
grant execute on function public.verify_payment(uuid)       to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;
grant execute on function public.review_report(uuid)        to authenticated;
grant execute on function public.set_user_role(uuid, text)  to authenticated;

-- ── COLUMN GRANTS ───────────────────────────────────────────────────────────
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, age, date_of_birth, gender, how_heard, wellness_note) on public.profiles to authenticated;
revoke insert, update, delete on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;
grant insert (service_id, family_member_id, num_days, start_date, time_slot, symptom_brief, payment_method, payment_proof_path, service_mode) on public.bookings to authenticated;
grant update (booking_status, symptom_brief, payment_proof_path, service_mode, assigned_to) on public.bookings to authenticated;
grant select, insert, update, delete on public.family_members   to authenticated;
grant select, insert, update, delete on public.services         to authenticated;
grant select, insert, update, delete on public.clinical_records to authenticated;
grant select, insert on public.report_uploads to authenticated;

-- ── ENABLE RLS ──────────────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.family_members   enable row level security;
alter table public.services         enable row level security;
alter table public.bookings         enable row level security;
alter table public.clinical_records enable row level security;
alter table public.report_uploads   enable row level security;
alter table public.profiles         force row level security;
alter table public.family_members   force row level security;
alter table public.services         force row level security;
alter table public.bookings         force row level security;
alter table public.clinical_records force row level security;
alter table public.report_uploads   force row level security;

-- ── POLICIES (drop-then-create = safe to re-run) ────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or public.in_household(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_staff()) with check (id = auth.uid() or public.is_staff());

drop policy if exists fam_select on public.family_members;
create policy fam_select on public.family_members for select to authenticated using (public.in_household(account_id) or public.is_staff());
drop policy if exists fam_insert on public.family_members;
create policy fam_insert on public.family_members for insert to authenticated with check (public.in_household(account_id) or public.is_staff());
drop policy if exists fam_update on public.family_members;
create policy fam_update on public.family_members for update to authenticated using (public.in_household(account_id) or public.is_staff()) with check (public.in_household(account_id) or public.is_staff());
drop policy if exists fam_delete on public.family_members;
create policy fam_delete on public.family_members for delete to authenticated using (public.in_household(account_id) or public.is_staff());

drop policy if exists svc_select on public.services;
create policy svc_select on public.services for select to authenticated using (active = true or public.is_staff());
drop policy if exists svc_write_admin on public.services;
create policy svc_write_admin on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists bk_select on public.bookings;
create policy bk_select on public.bookings for select to authenticated
  using (public.in_household(account_id) or public.is_admin() or (public.is_staff() and assigned_to = auth.uid()));
drop policy if exists bk_insert on public.bookings;
create policy bk_insert on public.bookings for insert to authenticated with check (account_id = auth.uid());
drop policy if exists bk_update on public.bookings;
create policy bk_update on public.bookings for update to authenticated
  using (public.in_household(account_id) or public.is_admin() or (public.is_staff() and assigned_to = auth.uid()))
  with check (public.in_household(account_id) or public.is_admin() or (public.is_staff() and assigned_to = auth.uid()));

drop policy if exists clin_select on public.clinical_records;
create policy clin_select on public.clinical_records for select to authenticated
  using (public.in_household(profile_id) or public.is_staff()
    or family_member_id in (select id from public.family_members where public.in_household(account_id)));
drop policy if exists clin_write_staff on public.clinical_records;
create policy clin_write_staff on public.clinical_records for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists report_insert on public.report_uploads;
create policy report_insert on public.report_uploads for insert to authenticated with check (public.is_staff());
drop policy if exists report_select on public.report_uploads;
create policy report_select on public.report_uploads for select to authenticated
  using (public.is_staff()
    or (reviewed and exists (select 1 from public.bookings b where b.id = report_uploads.booking_id and public.in_household(b.account_id))));

-- ── STORAGE BUCKETS ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs','payment-proofs', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr','payment-qr', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-reports','medical-reports', false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- payment-proofs policies
drop policy if exists pay_proof_insert on storage.objects;
create policy pay_proof_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] in (select id::text from public.bookings where account_id = auth.uid()));
drop policy if exists pay_proof_select on storage.objects;
create policy pay_proof_select on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists pay_proof_update on storage.objects;
create policy pay_proof_update on storage.objects for update to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists pay_proof_delete on storage.objects;
create policy pay_proof_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- payment-qr policies (public read, admin write)
drop policy if exists qr_public_read on storage.objects;
create policy qr_public_read on storage.objects for select using (bucket_id = 'payment-qr');
drop policy if exists qr_admin_insert on storage.objects;
create policy qr_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-qr' and public.is_admin());
drop policy if exists qr_admin_update on storage.objects;
create policy qr_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'payment-qr' and public.is_admin()) with check (bucket_id = 'payment-qr' and public.is_admin());
drop policy if exists qr_admin_delete on storage.objects;
create policy qr_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-qr' and public.is_admin());

-- medical-reports policies (staff write; household reads once reviewed)
-- Path convention: `<booking_id>/<uploaded_by>/<timestamp>.<ext>`.
drop policy if exists report_file_insert on storage.objects;
create policy report_file_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'medical-reports' and public.is_staff());
drop policy if exists report_file_select on storage.objects;
create policy report_file_select on storage.objects for select to authenticated
  using (bucket_id = 'medical-reports' and (
    public.is_staff()
    or exists (
      select 1 from public.report_uploads r join public.bookings b on b.id = r.booking_id
      where r.storage_path = storage.objects.name and r.reviewed and public.in_household(b.account_id)
    )
  ));

-- ── BOOKING REQUESTS (0010) — quick "contact me" lead, admin-only inbox ─────
create table if not exists public.booking_requests (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.profiles(id) on delete cascade,
  note         text,
  contacted    boolean not null default false,
  contacted_by uuid references public.profiles(id),
  contacted_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_booking_requests_account on public.booking_requests(account_id);

create or replace function public.tg_booking_request_stamp() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.account_id := auth.uid();
  return new;
end; $$;
drop trigger if exists tg_booking_requests_before_insert on public.booking_requests;
create trigger tg_booking_requests_before_insert before insert on public.booking_requests
  for each row execute function public.tg_booking_request_stamp();

create or replace function public.mark_request_contacted(p_request uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.booking_requests
     set contacted = true, contacted_by = auth.uid(), contacted_at = now()
   where id = p_request;
  if not found then raise exception 'request not found' using errcode = 'P0001'; end if;
end; $$;
revoke all on function public.mark_request_contacted(uuid) from public, anon;
grant execute on function public.mark_request_contacted(uuid) to authenticated;

alter table public.booking_requests enable row level security;
alter table public.booking_requests force row level security;
grant select, insert on public.booking_requests to authenticated;

drop policy if exists booking_request_insert on public.booking_requests;
create policy booking_request_insert on public.booking_requests for insert to authenticated
  with check (account_id = auth.uid());
drop policy if exists booking_request_select on public.booking_requests;
create policy booking_request_select on public.booking_requests for select to authenticated
  using (account_id = auth.uid() or public.is_admin());

-- ── SEED SERVICES ───────────────────────────────────────────────────────────
-- Retire anything already in the catalog first (mirrors migration 0006): a
-- piecemeal setup may still hold the original 6 placeholder services, and rows
-- can't be deleted (bookings.service_id is ON DELETE RESTRICT). The upsert below
-- then re-activates just the confirmed 4, with 0009's pricing model.
update public.services set active = false, updated_at = now();

insert into public.services (name, description, price_per_day, pricing_model) values
  ('Nutrition',        'Diet adherence (supported by strategic meal provider partnerships).', 2000, 'flat_advance'),
  ('Physio Therapy',   'Exercise completion, mobility scores.',                               2000, 'flat_advance'),
  ('Para-Medical',     'Vitals tracking (BP, Sugar, SpO2) and medication compliance.',        800,  'per_day'),
  ('Mental Wellbeing', 'Mood scores and social engagement tracking.',                         800,  'per_day')
on conflict (name) do update
  set description   = excluded.description,
      price_per_day = excluded.price_per_day,
      pricing_model = excluded.pricing_model,
      active        = true,
      updated_at    = now();
-- Upsert (not `do nothing`): this script repairs a piecemeal setup, where the
-- catalog may still hold stale prices/pricing models.

-- ── backfill report_uploads.patient_name/service_name (0014 repair path) ───
update public.report_uploads r
set service_name = b.service_name,
    patient_name = coalesce(fm.full_name, p.full_name, 'Patient')
from public.bookings b
left join public.family_members fm on fm.id = b.family_member_id
left join public.profiles p on p.id = b.account_id
where r.booking_id = b.id
  and (r.service_name is null or r.patient_name is null);

-- ── (optional) promote your founding admin — edit the phone, then uncomment ──
-- update public.profiles set role = 'admin', updated_at = now()
--  where id in (select id from auth.users where replace(phone,'+','') = '919000000001');

-- ── dev/test account role fixes (9000000002 = staff, 9000000003 = leaf_node) ──
-- `insert ... on conflict` rather than a plain `update` so this repairs the
-- account even if its profiles row is missing entirely (e.g. it was deleted
-- directly without also deleting the auth.users row) — a bare update would
-- silently match zero rows in that case. `replace(phone,'+','')` matches
-- regardless of whether the stored phone carries a leading `+` (Supabase Auth
-- itself stores it without one). Safe to delete this block once these two
-- numbers are no longer needed for testing.
insert into public.profiles (id, role, phone, full_name)
select u.id, 'staff', u.phone, coalesce(u.raw_user_meta_data->>'full_name', 'Staff')
from auth.users u where replace(u.phone, '+', '') = '919000000002'
on conflict (id) do update set role = excluded.role, updated_at = now();

insert into public.profiles (id, role, phone, full_name)
select u.id, 'leaf_node', u.phone, coalesce(u.raw_user_meta_data->>'full_name', 'Leaf Node')
from auth.users u where replace(u.phone, '+', '') = '919000000003'
on conflict (id) do update set role = excluded.role, updated_at = now();
