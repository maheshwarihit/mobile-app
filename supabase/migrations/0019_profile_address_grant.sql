-- ============================================================================
-- 0019: profiles.address was never actually grantable
-- ============================================================================
-- Migration 0011 added the `address` column and wired it into
-- useUpdateProfile()'s payload (web MemberEditForm, and now mobile's
-- CompleteProfileScreen) — but never widened the column-level UPDATE grant
-- to include it. Any update naming `address` was rejected outright with
-- "permission denied for table profiles", regardless of role or RLS, since
-- Postgres column-level grants reject the whole statement if it touches any
-- ungranted column. This has likely been silently broken since 0011 shipped
-- — nothing had reliably exercised a real address update against the live
-- database until now.

grant update (full_name, age, date_of_birth, gender, how_heard, wellness_note, address) on public.profiles to authenticated;
