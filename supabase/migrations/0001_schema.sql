-- ============================================================================
-- VAgeWell Care — Module 1 : 0001 schema
-- Tables, CHECK constraints, indexes. Functions/triggers → 0002; RLS → 0003.
-- All timestamps are UTC timestamptz (now() returns UTC). R4.1: relational storage.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ── profiles : extends auth.users (id = auth.uid()) ─────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'patient'
                  check (role in ('patient','staff','admin')),        -- GO-3
  full_name     text,
  phone         text,                                                 -- E.164, copied at signup
  age           int  check (age is null or (age >= 0 and age <= 150)),
  gender        text check (gender is null or
                  gender in ('male','female','other','prefer_not_to_say')),
  date_of_birth date,
  how_heard     text not null default 'web_search'                    -- PDF dropdown
                  check (how_heard in
                    ('web_search','referral','social_media','family_friend','advertisement','other')),
  wellness_note text,                                                  -- "How well are you?" (R1.5)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_profiles_role  on public.profiles(role);
create index idx_profiles_phone on public.profiles(phone);

-- ── family_members : dependents (R1.3 / R2.2) ───────────────────────────────
create table public.family_members (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.profiles(id) on delete cascade,
  full_name     text not null,
  age           int  check (age is null or (age >= 0 and age <= 150)),
  date_of_birth date,
  gender        text check (gender is null or
                  gender in ('male','female','other','prefer_not_to_say')),
  relationship  text not null
                  check (relationship in
                    ('spouse','parent','child','sibling','grandparent','grandchild','other')),
  contact_phone text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_family_members_account on public.family_members(account_id);

-- ── services : bookable care catalog (R2.3 / GO-1) ──────────────────────────
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  description   text,
  price_per_day numeric(10,2) not null check (price_per_day >= 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_services_active on public.services(active);

-- ── bookings : appointments (R1.4 / R2.4 / R2.5) ────────────────────────────
create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references public.profiles(id) on delete cascade,
  family_member_id    uuid references public.family_members(id) on delete set null,
  service_id          uuid not null references public.services(id) on delete restrict,

  -- server-authored snapshots (see tg_booking_snapshot in 0002)
  service_name        text not null,
  price_per_day       numeric(10,2) not null check (price_per_day >= 0),
  num_days            int not null check (num_days between 1 and 60),
  total_amount        numeric(12,2)
                        generated always as (num_days * price_per_day) stored,  -- R2.4 / GR-3

  -- scheduling (recorded only — GR-4)
  start_date          date not null,
  time_slot           time not null
                        check (extract(minute from time_slot) in (0,15,30,45)
                               and extract(second from time_slot) = 0
                               and time_slot between '06:00' and '21:00'),
  symptom_brief       text,

  payment_method      text not null check (payment_method in ('direct','online')),  -- GR-5
  payment_status      text not null
                        check (payment_status in
                          ('pending','pending_verification','paid','pay_at_visit')), -- R2.5
  payment_note        text,
  payment_proof_path  text,

  booking_status      text not null default 'open'
                        check (booking_status in ('open','closed','cancelled')),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- method ↔ status integrity (mirrors the state machine)
  -- direct: pay_at_visit → paid (cash collected on-site)
  -- online: pending → pending_verification → paid (or rejected back to pending)
  constraint chk_method_status check (
    (payment_method = 'direct' and payment_status in ('pay_at_visit','paid'))
    or
    (payment_method = 'online' and payment_status in ('pending','pending_verification','paid'))
  )
);
create index idx_bookings_account        on public.bookings(account_id);
create index idx_bookings_family_member  on public.bookings(family_member_id);
create index idx_bookings_service        on public.bookings(service_id);
create index idx_bookings_booking_status on public.bookings(booking_status);
create index idx_bookings_payment_status on public.bookings(payment_status);
create index idx_bookings_start_date     on public.bookings(start_date);
create index idx_bookings_created_at     on public.bookings(created_at desc);

-- ── clinical_records : vitals ledger (R1.7 / R2.7 / GR-6) ───────────────────
create table public.clinical_records (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid references public.profiles(id) on delete cascade,
  family_member_id   uuid references public.family_members(id) on delete cascade,
  recorded_by        uuid not null references public.profiles(id) on delete restrict,

  systolic           int  check (systolic  is null or systolic  between 40 and 300),  -- mmHg
  diastolic          int  check (diastolic is null or diastolic between 20 and 200),  -- mmHg
  blood_glucose      numeric(5,1) check (blood_glucose is null or blood_glucose >= 0),-- mg/dL
  spo2               int  check (spo2 is null or spo2 between 0 and 100),             -- %
  blood_group        text check (blood_group is null or
                        blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  medical_conditions text,
  note               text,

  recorded_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- exactly one subject: account holder XOR dependent
  constraint chk_one_subject check (
    (profile_id is not null)::int + (family_member_id is not null)::int = 1
  )
);
create index idx_clinical_profile       on public.clinical_records(profile_id);
create index idx_clinical_family_member on public.clinical_records(family_member_id);
create index idx_clinical_recorded_at   on public.clinical_records(recorded_at desc);
