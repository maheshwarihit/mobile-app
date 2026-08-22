-- 0037: a single, flat, GET-able view combining everything about a booking —
-- the patient's name/phone, the dependent's info (if booked for one), the
-- service, and the assigned caregiver — in one row, instead of needing a
-- separate GET per table and joining client-side. Mirrors the exact shape
-- `BOOKING_WITH_NAMES_SELECT` (shared/src/hooks.ts) already builds via a
-- nested Supabase select from the app; this makes the same combined shape
-- reachable with a plain `GET /rest/v1/bookings_full`.
--
-- `security_invoker = true` is the important part: without it, a Postgres
-- view runs with the *view creator's* privileges, bypassing RLS entirely —
-- a real security hole. With it (default-safe on Postgres 15+, which
-- Supabase provisions), the view enforces RLS as the *calling* user, so
-- `bookings`/`profiles`/`family_members`'s existing policies (a patient
-- sees only their own household; staff/admin see everyone) apply exactly
-- the same way they already do on the underlying tables — this view adds
-- no new access, just a more convenient shape for what's already visible.

create or replace view public.bookings_full
with (security_invoker = true) as
select
  b.*,
  acc.full_name    as account_full_name,
  acc.phone        as account_phone,
  acc.age          as account_age,
  fm.full_name     as dependent_full_name,
  fm.relationship  as dependent_relationship,
  fm.age           as dependent_age,
  fm.contact_phone as dependent_contact_phone,
  asg.full_name    as assignee_full_name,
  asg.phone        as assignee_phone
from public.bookings b
left join public.profiles acc on acc.id = b.account_id
left join public.family_members fm on fm.id = b.family_member_id
left join public.profiles asg on asg.id = b.assigned_to;

grant select on public.bookings_full to authenticated;
