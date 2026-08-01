-- ============================================================================
-- 0018: admin can create a full appointment on a specific patient's behalf
-- ============================================================================
-- User decision: admin taking a phone call should be able to book a real
-- appointment (service/date/payment) for the caller directly, not just log a
-- lead (0017 covered that lighter case). Scope, per explicit decision:
-- existing accounts only (no walk-up account creation here), Pay at Visit
-- only (payment_method = 'direct' — no online proof-upload UI on this path).
--
-- Same pattern as 0017: `tg_booking_snapshot()` preserves a caller-supplied
-- `account_id` only when the caller is admin; every other insert (a
-- patient's own booking) still stamps to auth.uid() exactly as before. The
-- "profile incomplete" and "family_member belongs to caller" checks now
-- validate against the resolved `new.account_id` rather than a literal
-- `auth.uid()`, which is a no-op for a patient's own booking (the two are
-- the same value there) but correctly checks the *target* patient for an
-- admin-created one.

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
  new.assigned_to    := null;
  return new;
end; $$;

drop policy if exists bk_insert on public.bookings;
create policy bk_insert on public.bookings for insert to authenticated
  with check (account_id = auth.uid() or public.is_admin());

-- account_id was never in the column-insert grant (only the trigger ever set
-- it) — widen it so an admin's insert statement can include the target
-- patient's id at all. Harmless for a plain patient's own insert: the
-- trigger above still forces their account_id back to auth.uid() regardless
-- of what they submit, since is_admin() is false for them.
grant insert (account_id, service_id, family_member_id, num_days, start_date, time_slot, symptom_brief, payment_method, payment_proof_path, service_mode) on public.bookings to authenticated;
