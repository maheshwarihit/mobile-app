-- 0044 stopped auto-calculating total_amount on new bookings, but any booking
-- inserted *before* 0044 ran already has a stale, auto-calculated amount
-- stored on the row (e.g. Para-Medical showing a pre-filled ₹800 the admin
-- never actually entered). Clear it on any booking that hasn't been marked
-- paid yet, so it goes back to blank for admin to set fresh, same as every
-- new booking now does. A booking already marked 'paid' is left untouched —
-- that amount is real settled history, not a stale placeholder.
--
-- 0044's own tg_booking_update_guard() blocks a total_amount change unless
-- the caller is admin — but the SQL Editor session running this script isn't
-- one, so this bulk UPDATE would hit the same "admin only" error the
-- migration itself just introduced. Same fix already used for the 0009
-- booking_status backfill: disable the trigger around this one statement,
-- then re-enable it, guarded by an existence check so it's correct whether
-- the trigger already exists (a re-run) or not (a genuinely fresh install).
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'tg_bookings_before_update' and tgrelid = 'public.bookings'::regclass) then
    execute 'alter table public.bookings disable trigger tg_bookings_before_update';
  end if;
end $$;
update public.bookings
set total_amount = null
where payment_status <> 'paid';
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'tg_bookings_before_update' and tgrelid = 'public.bookings'::regclass) then
    execute 'alter table public.bookings enable trigger tg_bookings_before_update';
  end if;
end $$;
