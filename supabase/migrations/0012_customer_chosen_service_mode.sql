-- ============================================================================
-- VAgeWell Care — 0012 customer-chosen service mode
-- Previously `service_mode` (Clinic Visit vs Home Care) was decided by admin
-- at approval time; the customer now picks it directly on the Appointment
-- screen when booking. Admin still assigns the specific staff/leaf_node
-- member, but no longer chooses the mode itself.
-- Assumes 0001–0011 already applied.
-- ============================================================================

-- Patients could not previously write this column at all (column-level grant
-- didn't include it — service_mode was admin-only, set via UPDATE at approval).
grant insert (service_id, family_member_id, num_days, start_date, time_slot,
              symptom_brief, payment_method, payment_proof_path, service_mode)
  on public.bookings to authenticated;

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
  -- service_mode is left as the customer's choice (validated above) — no
  -- longer forced to null for admin to decide later.
  new.assigned_to := null;
  return new;
end; $$;
