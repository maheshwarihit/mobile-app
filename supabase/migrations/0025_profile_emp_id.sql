-- ============================================================================
-- 0025: Employee ID field on profiles, for the ops-side "My Profile" panel
-- ============================================================================
-- New "My Profile" popover (clicking the avatar in the web portal header)
-- shows/edits Name, Address, and Employee ID alongside the existing
-- read-only Phone/Role. There is no employee-ID system anywhere in this
-- project (auth stays phone+OTP, per the 2026-07-29 decision) — this is
-- purely a free-text field an ops account can record for itself, same
-- shape as `address` (0011).

alter table public.profiles add column if not exists emp_id text;

-- Same grant-list mistake 0019 fixed for `address` — a column must be named
-- in the UPDATE grant list or Postgres rejects the whole statement outright,
-- regardless of role/RLS. Adding it here up front instead of waiting to
-- discover the same bug again.
grant update (full_name, age, date_of_birth, gender, how_heard, wellness_note, address, avatar_path, emp_id) on public.profiles to authenticated;
