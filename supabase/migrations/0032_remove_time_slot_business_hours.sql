-- 0032: drop the business-hours restriction on bookings.time_slot — any time
-- of day can now be picked, not just 06:00–21:00 (removed by request; the app
-- side no longer restricts the hour picker either). The 15-minute-boundary
-- requirement stays — the picker itself only ever offers :00/:15/:30/:45
-- minutes, so this isn't a new restriction in practice.

alter table public.bookings drop constraint if exists bookings_time_slot_check;
alter table public.bookings add constraint bookings_time_slot_check
  check (extract(minute from time_slot) in (0,15,30,45) and extract(second from time_slot) = 0);
