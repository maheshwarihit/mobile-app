-- ============================================================================
-- VAgeWell Care — 0002 functions, triggers, RPCs
-- Server-authored logic that RLS alone cannot express (R3.1 server-side role
-- check, R2.4 pricing integrity, R3.3 payment quarantine, no role escalation).
-- Functions are owned by `postgres` (migration role) → SECURITY DEFINER bodies
-- bypass RLS, so is_staff()/is_admin() reading profiles causes no recursion.
-- ============================================================================

-- ── Role helpers (R3.1) ─────────────────────────────────────────────────────
create or replace function public.is_staff()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff','admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ── updated_at stamper ──────────────────────────────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tg_profiles_updated_at        before update on public.profiles         for each row execute function public.tg_set_updated_at();
create trigger tg_family_members_updated_at  before update on public.family_members   for each row execute function public.tg_set_updated_at();
create trigger tg_services_updated_at        before update on public.services         for each row execute function public.tg_set_updated_at();
create trigger tg_bookings_updated_at        before update on public.bookings         for each row execute function public.tg_set_updated_at();
create trigger tg_clinical_updated_at        before update on public.clinical_records for each row execute function public.tg_set_updated_at();

-- ── Auto-provision profile on signup (role HARDCODED 'patient') ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_age int;
begin
  -- safe age cast: only if the metadata value is all digits
  if coalesce(new.raw_user_meta_data->>'age','') ~ '^\d+$' then
    v_age := (new.raw_user_meta_data->>'age')::int;
  else
    v_age := null;
  end if;

  insert into public.profiles (id, role, phone, full_name, age, how_heard, wellness_note)
  values (
    new.id,
    'patient',                                                        -- never from metadata
    new.phone,
    nullif(new.raw_user_meta_data->>'full_name',''),
    v_age,
    coalesce(nullif(new.raw_user_meta_data->>'how_heard',''), 'web_search'),
    nullif(new.raw_user_meta_data->>'wellness_note','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Booking snapshot on INSERT (R2.4 pricing integrity, GR-5 status) ────────
create or replace function public.tg_booking_snapshot()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_price numeric(10,2); v_name text; v_active boolean;
begin
  new.account_id := auth.uid();                     -- defeat account spoofing

  -- R3.5: downstream booking is gated on a complete base profile
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and full_name is not null
      and length(trim(full_name)) > 0
  ) then
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
  if not found or not v_active then
    raise exception 'service unavailable' using errcode = '23503';
  end if;
  new.price_per_day := v_price;                     -- authoritative snapshot
  new.service_name  := v_name;

  if new.payment_method = 'direct' then
    new.payment_status := 'pay_at_visit';
  else -- online
    new.payment_status := case when new.payment_proof_path is not null
                               then 'pending_verification' else 'pending' end;
  end if;

  new.booking_status := 'open';
  return new;
end;
$$;

create trigger tg_bookings_before_insert
  before insert on public.bookings
  for each row execute function public.tg_booking_snapshot();

-- ── Booking update guard: immutable snapshots + state machine (R3.3) ────────
create or replace function public.tg_booking_update_guard()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  -- freeze identity + snapshot + scheduling fields
  if new.account_id       is distinct from old.account_id
  or new.family_member_id is distinct from old.family_member_id
  or new.service_id       is distinct from old.service_id
  or new.service_name     is distinct from old.service_name
  or new.price_per_day    is distinct from old.price_per_day
  or new.num_days         is distinct from old.num_days
  or new.start_date       is distinct from old.start_date
  or new.time_slot        is distinct from old.time_slot
  or new.payment_method   is distinct from old.payment_method then
    raise exception 'immutable booking field changed' using errcode = '42501';
  end if;

  -- proof image is frozen once payment is settled (no post-hoc swaps)
  if new.payment_proof_path is distinct from old.payment_proof_path
     and old.payment_status = 'paid' then
    raise exception 'cannot change payment proof after settlement' using errcode = '42501';
  end if;

  -- patient attaches proof → auto-advance pending → pending_verification
  if new.payment_proof_path is not null and old.payment_proof_path is null
     and old.payment_status = 'pending' and new.payment_method = 'online' then
    new.payment_status := 'pending_verification';
  end if;

  -- payment_status transitions: staff via RPC, or the proof-attach case above
  if new.payment_status is distinct from old.payment_status then
    if public.is_staff() then
      null;
    elsif old.payment_status = 'pending' and new.payment_status = 'pending_verification' then
      null;
    else
      raise exception 'illegal payment_status transition' using errcode = '42501';
    end if;
  end if;

  -- booking_status transitions
  if new.booking_status is distinct from old.booking_status then
    if public.is_staff() then
      if not (old.booking_status = 'open' and new.booking_status in ('closed','cancelled')) then
        raise exception 'illegal booking_status transition' using errcode = '42501';
      end if;
    else
      if not (old.booking_status = 'open' and new.booking_status = 'cancelled') then
        raise exception 'illegal booking_status transition' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger tg_bookings_before_update
  before update on public.bookings
  for each row execute function public.tg_booking_update_guard();

-- ── Clinical record: stamp the acting staff/admin ───────────────────────────
create or replace function public.tg_clinical_before_write()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  new.recorded_by := auth.uid();
  return new;
end;
$$;

create trigger tg_clinical_before_insert
  before insert on public.clinical_records
  for each row execute function public.tg_clinical_before_write();

-- ── Payment RPCs (staff/admin authoritative path, R3.3) ─────────────────────
create or replace function public.verify_payment(p_booking uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  update public.bookings
     set payment_status = 'paid', payment_note = null
   where id = p_booking
     and payment_status in ('pending_verification','pay_at_visit');
  if not found then
    raise exception 'booking not in a verifiable state' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.reject_payment(p_booking uuid, p_reason text)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  update public.bookings
     set payment_status = 'pending',
         payment_note = coalesce(nullif(p_reason,''), 'Rejected — please re-upload a valid proof.'),
         payment_proof_path = null
   where id = p_booking and payment_status = 'pending_verification';
  if not found then
    raise exception 'booking not awaiting verification' using errcode = 'P0001';
  end if;
end;
$$;

-- ── Admin-only role change: the ONLY in-app path to mutate role ──────────────
create or replace function public.set_user_role(p_user uuid, p_role text)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_role not in ('patient','staff','admin') then
    raise exception 'invalid role';
  end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

revoke all on function public.verify_payment(uuid)       from public, anon;
revoke all on function public.reject_payment(uuid, text) from public, anon;
revoke all on function public.set_user_role(uuid, text)  from public, anon;
grant execute on function public.verify_payment(uuid)       to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;
grant execute on function public.set_user_role(uuid, text)  to authenticated;
