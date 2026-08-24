-- total_amount is no longer auto-calculated from the service catalog at
-- booking time — admin sets the real amount after the visit, based on what
-- actually happened, not a generic per-day/flat catalog price. This is the
-- same "no predefined price — the care assistant/admin shares it after the
-- visit" decision from earlier in this project, now extended from "hidden
-- from the customer" to "not even computed automatically" on the admin
-- side either. price_per_day/pricing_model are still snapshotted from the
-- service as reference data; only total_amount changes.

create or replace function public.tg_booking_snapshot() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_price numeric(10,2); v_name text; v_active boolean; v_pricing_model text;
begin
  if not (public.is_admin() and new.account_id is not null) then
    new.account_id := auth.uid();
  end if;
  if not exists (select 1 from public.profiles
                 where id = new.account_id and full_name is not null and length(trim(full_name)) > 0) then
    raise exception 'profile incomplete: add your name before booking' using errcode = '42501';
  end if;
  if new.family_member_id is not null then
    if not exists (select 1 from public.family_members
                   where id = new.family_member_id and account_id = new.account_id) then
      raise exception 'family_member does not belong to caller' using errcode = '42501';
    end if;
  end if;
  if new.service_mode is distinct from 'home_care' then
    raise exception 'visit type must be home care' using errcode = '23514';
  end if;
  select price_per_day, name, active, pricing_model into v_price, v_name, v_active, v_pricing_model
  from public.services where id = new.service_id;
  if not found or not v_active then raise exception 'service unavailable' using errcode = '23503'; end if;
  new.price_per_day := v_price;
  new.service_name  := v_name;
  new.pricing_model := v_pricing_model;
  new.total_amount  := null;
  if new.payment_method = 'direct' then
    new.payment_status := 'pay_at_visit';
  else
    new.payment_status := case when new.payment_proof_path is not null
                               then 'pending_verification' else 'pending' end;
  end if;
  new.booking_status := 'requested';
  new.assigned_to    := null;
  return new;
end; $$;

-- Admin-only: settable after the visit, via the Review modal.
grant update (total_amount) on public.bookings to authenticated;

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

  if new.total_amount is distinct from old.total_amount and not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
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
    if new.booking_status = 'completed'
       and not exists (select 1 from public.visit_photos where booking_id = new.id) then
      raise exception 'a visit photo (Care Giver with patient) is required before completing' using errcode = '23514';
    end if;
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
