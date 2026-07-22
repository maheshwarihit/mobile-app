-- ============================================================================
-- VAgeWell Care — CONSOLIDATED "install everything" (idempotent, safe to re-run)
-- Paste into the hosted project's SQL Editor and Run. Combines migrations
-- 0001–0005 + the services seed. Fixes a project that was set up piecemeal.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── TABLES ──────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'patient' check (role in ('patient','staff','admin')),
  full_name     text,
  phone         text,
  age           int  check (age is null or (age >= 0 and age <= 150)),
  gender        text check (gender is null or gender in ('male','female','other','prefer_not_to_say')),
  date_of_birth date,
  how_heard     text not null default 'web_search'
                  check (how_heard in ('web_search','referral','social_media','family_friend','advertisement','other')),
  wellness_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.family_members (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.profiles(id) on delete cascade,
  full_name     text not null,
  age           int  check (age is null or (age >= 0 and age <= 150)),
  date_of_birth date,
  gender        text check (gender is null or gender in ('male','female','other','prefer_not_to_say')),
  relationship  text not null
                  check (relationship in ('spouse','parent','child','sibling','grandparent','grandchild','other')),
  contact_phone text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  description   text,
  price_per_day numeric(10,2) not null check (price_per_day >= 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.profiles(id) on delete cascade,
  family_member_id   uuid references public.family_members(id) on delete set null,
  service_id         uuid not null references public.services(id) on delete restrict,
  service_name       text not null,
  price_per_day      numeric(10,2) not null check (price_per_day >= 0),
  num_days           int not null check (num_days between 1 and 60),
  total_amount       numeric(12,2) generated always as (num_days * price_per_day) stored,
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
  booking_status     text not null default 'open' check (booking_status in ('open','closed','cancelled')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint chk_method_status check (
    (payment_method = 'direct' and payment_status in ('pay_at_visit','paid'))
    or (payment_method = 'online' and payment_status in ('pending','pending_verification','paid'))
  )
);

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

create index if not exists idx_profiles_role         on public.profiles(role);
create index if not exists idx_family_members_account on public.family_members(account_id);
create index if not exists idx_services_active        on public.services(active);
create index if not exists idx_bookings_account       on public.bookings(account_id);
create index if not exists idx_bookings_created_at    on public.bookings(created_at desc);
create index if not exists idx_clinical_profile       on public.clinical_records(profile_id);
create index if not exists idx_clinical_family_member on public.clinical_records(family_member_id);

-- ── ROLE HELPERS ────────────────────────────────────────────────────────────
create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin')); $$;
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ── updated_at STAMPER ──────────────────────────────────────────────────────
create or replace function public.tg_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists tg_profiles_updated_at        on public.profiles;
drop trigger if exists tg_family_members_updated_at  on public.family_members;
drop trigger if exists tg_services_updated_at        on public.services;
drop trigger if exists tg_bookings_updated_at        on public.bookings;
drop trigger if exists tg_clinical_updated_at        on public.clinical_records;
create trigger tg_profiles_updated_at       before update on public.profiles         for each row execute function public.tg_set_updated_at();
create trigger tg_family_members_updated_at before update on public.family_members   for each row execute function public.tg_set_updated_at();
create trigger tg_services_updated_at       before update on public.services         for each row execute function public.tg_set_updated_at();
create trigger tg_bookings_updated_at       before update on public.bookings         for each row execute function public.tg_set_updated_at();
create trigger tg_clinical_updated_at       before update on public.clinical_records for each row execute function public.tg_set_updated_at();

-- ── AUTO-PROVISION PROFILE ON SIGNUP ────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_age int;
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
declare v_price numeric(10,2); v_name text; v_active boolean;
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
  select price_per_day, name, active into v_price, v_name, v_active
  from public.services where id = new.service_id;
  if not found or not v_active then raise exception 'service unavailable' using errcode = '23503'; end if;
  new.price_per_day := v_price;
  new.service_name  := v_name;
  if new.payment_method = 'direct' then
    new.payment_status := 'pay_at_visit';
  else
    new.payment_status := case when new.payment_proof_path is not null
                               then 'pending_verification' else 'pending' end;
  end if;
  new.booking_status := 'open';
  return new;
end; $$;
drop trigger if exists tg_bookings_before_insert on public.bookings;
create trigger tg_bookings_before_insert before insert on public.bookings
  for each row execute function public.tg_booking_snapshot();

-- ── BOOKING UPDATE GUARD ────────────────────────────────────────────────────
create or replace function public.tg_booking_update_guard() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.account_id is distinct from old.account_id
  or new.family_member_id is distinct from old.family_member_id
  or new.service_id is distinct from old.service_id
  or new.service_name is distinct from old.service_name
  or new.price_per_day is distinct from old.price_per_day
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
  if new.booking_status is distinct from old.booking_status then
    if public.is_staff() then
      if not (old.booking_status = 'open' and new.booking_status in ('closed','cancelled')) then
        raise exception 'illegal booking_status transition' using errcode = '42501'; end if;
    else
      if not (old.booking_status = 'open' and new.booking_status = 'cancelled') then
        raise exception 'illegal booking_status transition' using errcode = '42501'; end if;
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

-- ── PAYMENT / ROLE RPCs ─────────────────────────────────────────────────────
create or replace function public.verify_payment(p_booking uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  update public.bookings set payment_status = 'paid', payment_note = null
   where id = p_booking and payment_status in ('pending_verification','pay_at_visit');
  if not found then raise exception 'booking not in a verifiable state' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.reject_payment(p_booking uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  update public.bookings
     set payment_status = 'pending',
         payment_note = coalesce(nullif(p_reason,''), 'Rejected — please re-upload a valid proof.'),
         payment_proof_path = null
   where id = p_booking and payment_status = 'pending_verification';
  if not found then raise exception 'booking not awaiting verification' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.set_user_role(p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_role not in ('patient','staff','admin') then raise exception 'invalid role'; end if;
  update public.profiles set role = p_role where id = p_user;
end; $$;

revoke all on function public.verify_payment(uuid)       from public, anon;
revoke all on function public.reject_payment(uuid, text) from public, anon;
revoke all on function public.set_user_role(uuid, text)  from public, anon;
grant execute on function public.verify_payment(uuid)       to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;
grant execute on function public.set_user_role(uuid, text)  to authenticated;

-- ── COLUMN GRANTS ───────────────────────────────────────────────────────────
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, age, date_of_birth, gender, how_heard, wellness_note) on public.profiles to authenticated;
revoke insert, update, delete on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;
grant insert (service_id, family_member_id, num_days, start_date, time_slot, symptom_brief, payment_method, payment_proof_path) on public.bookings to authenticated;
grant update (booking_status, symptom_brief, payment_proof_path) on public.bookings to authenticated;
grant select, insert, update, delete on public.family_members   to authenticated;
grant select, insert, update, delete on public.services         to authenticated;
grant select, insert, update, delete on public.clinical_records to authenticated;

-- ── ENABLE RLS ──────────────────────────────────────────────────────────────
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

-- ── POLICIES (drop-then-create = safe to re-run) ────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_staff()) with check (id = auth.uid() or public.is_staff());

drop policy if exists fam_select on public.family_members;
create policy fam_select on public.family_members for select to authenticated using (account_id = auth.uid() or public.is_staff());
drop policy if exists fam_insert on public.family_members;
create policy fam_insert on public.family_members for insert to authenticated with check (account_id = auth.uid() or public.is_staff());
drop policy if exists fam_update on public.family_members;
create policy fam_update on public.family_members for update to authenticated using (account_id = auth.uid() or public.is_staff()) with check (account_id = auth.uid() or public.is_staff());
drop policy if exists fam_delete on public.family_members;
create policy fam_delete on public.family_members for delete to authenticated using (account_id = auth.uid() or public.is_staff());

drop policy if exists svc_select on public.services;
create policy svc_select on public.services for select to authenticated using (active = true or public.is_staff());
drop policy if exists svc_write_admin on public.services;
create policy svc_write_admin on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists bk_select on public.bookings;
create policy bk_select on public.bookings for select to authenticated using (account_id = auth.uid() or public.is_staff());
drop policy if exists bk_insert on public.bookings;
create policy bk_insert on public.bookings for insert to authenticated with check (account_id = auth.uid());
drop policy if exists bk_update on public.bookings;
create policy bk_update on public.bookings for update to authenticated using (account_id = auth.uid() or public.is_staff()) with check (account_id = auth.uid() or public.is_staff());

drop policy if exists clin_select on public.clinical_records;
create policy clin_select on public.clinical_records for select to authenticated
  using (profile_id = auth.uid() or public.is_staff()
    or family_member_id in (select id from public.family_members where account_id = auth.uid()));
drop policy if exists clin_write_staff on public.clinical_records;
create policy clin_write_staff on public.clinical_records for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── STORAGE BUCKETS ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs','payment-proofs', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr','payment-qr', true, 5242880, array['image/png','image/jpeg','image/webp'])
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

-- ── SEED SERVICES ───────────────────────────────────────────────────────────
insert into public.services (name, description, price_per_day) values
  ('Physiotherapy',        'In-home physiotherapy session by a licensed therapist.', 1500),
  ('Nursing Care',         'Home nursing and bedside care for recovering patients.', 1200),
  ('Elderly Attendant',    'Daily attendant support for elderly household members.',  900),
  ('Post-Surgical Care',   'Post-operative recovery, dressing and wound care.',       1800),
  ('Doctor Home Visit',    'Physician consultation at your home.',                    2000),
  ('Lab Sample Collection','At-home collection of pathology samples.',                 500)
on conflict (name) do nothing;

-- ── (optional) promote your founding admin — edit the phone, then uncomment ──
-- update public.profiles set role = 'admin', updated_at = now()
--  where id in (select id from auth.users where replace(phone,'+','') = '919000000001');
