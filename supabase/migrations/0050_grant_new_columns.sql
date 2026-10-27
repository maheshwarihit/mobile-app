-- =====================================================================
-- VAgeWell Care — 0050 Allow updating the columns added in 0048 / 0049
-- =====================================================================
-- profiles and bookings only accept UPDATEs of the columns listed in a
-- column-level GRANT (0046 for profiles, 0009 / 0044 for bookings); any
-- UPDATE naming another column is rejected with "permission denied",
-- whatever the row-level policies say. The new columns need adding:
--   * profiles.height_cm / weight_kg  (0048) — saving the profile
--   * bookings.rescheduled_at         (0049) — Reschedule
-- family_members has a table-wide grant (0003), so nothing is needed there.
-- Row-level rules still decide whose rows may be changed.
--
-- Run once in the Supabase SQL editor, after 0048 and 0049 (safe to re-run).
-- =====================================================================
grant update (height_cm, weight_kg) on public.profiles to authenticated;
grant update (rescheduled_at) on public.bookings to authenticated;
