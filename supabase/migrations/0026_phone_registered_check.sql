-- ============================================================================
-- 0026: phone_registered() — lets Sign-up warn "this number already has an
-- account" before sending an OTP, instead of silently OTP-logging the caller
-- into their existing account under the Sign-up tab.
-- ============================================================================
-- signInWithOtp() with the default shouldCreateUser:true never errors for an
-- already-registered number — it just sends a login OTP for the existing
-- account, and requested_role/full_name metadata is silently ignored since
-- handle_new_user() only ever fires on a brand-new auth.users insert. That's
-- confusing during Sign-up specifically (the caller thinks they're creating a
-- new account) and, for the Staff/Admin role picker (see AuthModal's
-- `rolePicker`), can look like "my role pick did nothing."
--
-- This function runs pre-auth (anon), so it can't reach `public.profiles`
-- RLS-safely — it reads `auth.users` directly, security definer, and returns
-- only a boolean. No name/role/other profile data is exposed through it.

create or replace function public.phone_registered(p_phone text) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from auth.users where phone = regexp_replace(p_phone, '\D', '', 'g')
  );
$$;
revoke all on function public.phone_registered(text) from public;
grant execute on function public.phone_registered(text) to anon, authenticated;
