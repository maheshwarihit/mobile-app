-- ============================================================================
-- 0024: "User Details" — pre-registration patient leads
-- ============================================================================
-- User decision: the admin Dashboard's "+" (NewAppointmentModal) only ever
-- let admin book for an EXISTING patient account, since `bookings.account_id`
-- (like every `profiles.id`) is a foreign key into `auth.users` — there is no
-- way to create a real patient record without a real, phone-verified Auth
-- account behind it. Explicit trade-off confirmed with the user, given a
-- choice between this and a new server-side Edge Function using the
-- service-role key (a real infrastructure/security change this project has
-- deliberately avoided so far): admin can log a brand-new caller's name +
-- phone as a lightweight "lead" here — NOT a real patient account yet — and
-- once that phone number completes an ordinary OTP signup (same as any
-- patient registering today, on mobile or via the web self-service Register
-- page), the lead is auto-marked claimed, same auto-link pattern
-- `family_members.contact_phone` already uses in `handle_new_user()`.

create table if not exists public.patient_leads (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null,
  phone              text not null,
  note               text,
  created_by         uuid not null references public.profiles(id),
  claimed_profile_id uuid references public.profiles(id),
  created_at         timestamptz not null default now()
);
create index if not exists idx_patient_leads_claimed on public.patient_leads(claimed_profile_id);

create or replace function public.tg_patient_lead_stamp() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.created_by := auth.uid();
  return new;
end; $$;
drop trigger if exists tg_patient_leads_before_insert on public.patient_leads;
create trigger tg_patient_leads_before_insert before insert on public.patient_leads
  for each row execute function public.tg_patient_lead_stamp();

alter table public.patient_leads enable row level security;
alter table public.patient_leads force row level security;
grant select, insert on public.patient_leads to authenticated;

drop policy if exists patient_lead_select on public.patient_leads;
create policy patient_lead_select on public.patient_leads for select to authenticated using (public.is_admin());
drop policy if exists patient_lead_insert on public.patient_leads;
create policy patient_lead_insert on public.patient_leads for insert to authenticated with check (public.is_admin());

-- Auto-claim on real signup — mirrors the family_members.contact_phone
-- auto-link already in this function, just for leads instead of dependents.
-- `create or replace` of the full function (Postgres has no way to patch one
-- statement into an existing function body).
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_age int; v_family_row public.family_members; v_role text;
begin
  if coalesce(new.raw_user_meta_data->>'age','') ~ '^\d+$'
    then v_age := (new.raw_user_meta_data->>'age')::int; else v_age := null; end if;
  v_role := nullif(new.raw_user_meta_data->>'requested_role','');
  if v_role is null or v_role not in ('admin','leaf_node') then
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

    -- 0024: mark any matching pending lead(s) as claimed by this new account.
    update public.patient_leads set claimed_profile_id = new.id
     where phone = new.phone and claimed_profile_id is null;
  end if;
  return new;
end; $$;
