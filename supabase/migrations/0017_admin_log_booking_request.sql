-- ============================================================================
-- 0017: admin can log a booking request on a specific patient's behalf
-- ============================================================================
-- The "Request for Booking" inbox (0010) only ever let a customer create a
-- request for themselves (account_id always stamped to auth.uid()) — there
-- was no way for an admin to log an incoming phone call as a request against
-- a specific patient's account. `tg_booking_request_stamp()` now preserves a
-- caller-supplied `account_id` when (and only when) the caller is admin;
-- every other case — a patient's own self-service insert, or an admin
-- inserting with no account_id given — still stamps to auth.uid() exactly as
-- before, so ordinary customer behavior is unchanged.

create or replace function public.tg_booking_request_stamp() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not (public.is_admin() and new.account_id is not null) then
    new.account_id := auth.uid();
  end if;
  return new;
end; $$;

drop policy if exists booking_request_insert on public.booking_requests;
create policy booking_request_insert on public.booking_requests for insert to authenticated
  with check (account_id = auth.uid() or public.is_admin());
