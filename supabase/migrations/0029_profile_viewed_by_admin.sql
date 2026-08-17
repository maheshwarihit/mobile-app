-- ============================================================================
-- 0029: User Details' "New" badge clears once an admin actually views them,
-- not on a fixed 24h timer
-- ============================================================================
-- Previously `isNewSignup()` (created_at < 24h ago) decided the red "New"
-- pill on AdminUserDetailsScreen. User asked for it to instead clear the
-- moment an admin opens that person's Client detail page — a real "seen"
-- signal instead of a timer nobody controls.

alter table public.profiles add column if not exists viewed_by_admin_at timestamptz;

-- Backfill: every profile that already existed before this feature shipped
-- is not "new" — without this, the column starts null for everyone, and the
-- "New" pill (which reads "null = never viewed") would wrongly light up on
-- every pre-existing client the moment this migration runs. Fixed cutoff
-- (not `now()`) deliberately — `install_all.sql` gets re-run repeatedly in
-- this project, and a `now()` backfill would re-mark a genuinely new,
-- still-unviewed sign-up as "viewed" on every later re-run. Anyone created
-- before this migration was written is backfilled exactly once; anyone
-- created after it is never touched by this line, no matter how many times
-- the script re-runs.
update public.profiles set viewed_by_admin_at = created_at
 where viewed_by_admin_at is null and created_at < '2026-08-12'::timestamptz;

-- Same lesson 0019/0025/0027 already paid for: a column must be named in the
-- UPDATE grant list or Postgres rejects the whole statement outright.
grant update (full_name, age, date_of_birth, gender, how_heard, wellness_note, address, avatar_path, emp_id, viewed_by_admin_at)
  on public.profiles to authenticated;
