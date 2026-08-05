-- ============================================================================
-- 0021: retire the 'staff' role — only patient/admin/leaf_node remain
-- ============================================================================
-- User decision: "only admin and leaf node is enough, doesn't need staff
-- role" — full removal, not just hiding it from a picker. Since staff and
-- leaf_node have been functionally identical for assignment purposes since
-- Clinic Visit was retired in 0020 (both eligible for Home Care, and Clinic
-- is legacy-only now), any existing staff account is reassigned to
-- leaf_node rather than demoted — nobody loses access.

-- Reassign before tightening the constraint below, so no existing row
-- violates it mid-migration.
update public.profiles set role = 'leaf_node', updated_at = now() where role = 'staff';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('patient','admin','leaf_node'));

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leaf_node')); $$;

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

create or replace function public.set_user_role(p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_role not in ('patient','admin','leaf_node') then raise exception 'invalid role'; end if;
  update public.profiles set role = p_role where id = p_user;
end; $$;

-- assigned_to eligibility: leaf_node is the only assignable role now, for a
-- legacy Clinic-mode booking as much as a Home Care one (previously Clinic
-- required 'staff', Home Care allowed 'staff' or 'leaf_node' — see 0020).
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
      if not exists (select 1 from public.profiles where id = new.assigned_to and role = 'leaf_node') then
        raise exception 'assigned_to must be a leaf_node member' using errcode = '23514';
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

-- dev/test account 9000000002 repointed from staff to admin — 'staff' role
-- retired, and this keeps a distinct test account per remaining ops role
-- rather than duplicating 9000000003's leaf_node.
insert into public.profiles (id, role, phone, full_name)
select u.id, 'admin', u.phone, coalesce(u.raw_user_meta_data->>'full_name', 'Admin')
from auth.users u where replace(u.phone, '+', '') = '919000000002'
on conflict (id) do update set role = excluded.role, updated_at = now();
