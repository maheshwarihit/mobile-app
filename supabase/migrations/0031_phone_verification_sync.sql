-- 0031: sync profiles.phone (and run the same auto-link matching
-- handle_new_user() does at signup) once a Google-signed-in account later
-- adds and verifies a phone number.
--
-- Context: "Continue with Google" creates a real session immediately, but a
-- Google identity has no phone (auth.users.phone stays null). The app now
-- requires every account to also verify a real phone via OTP before it can
-- use the app (mobile/src/screens/VerifyPhoneScreen.tsx, gated in
-- RootNavigator on `!profile.phone`) — that screen calls Supabase's standard
-- phone-change flow: `auth.updateUser({ phone })` then
-- `auth.verifyOtp({ type: 'phone_change' })`, which updates auth.users.phone
-- directly. handle_new_user() only ever fires on INSERT, so nothing kept
-- profiles.phone (client-unwritable by design — see the profiles UPDATE
-- grant) in sync with a later phone-change, and nothing ran the
-- family_members/patient_leads auto-link matching for this case either.
-- This trigger fills both gaps, mirroring handle_new_user()'s own logic.

create or replace function public.handle_user_phone_verified() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_family_row public.family_members;
begin
  update public.profiles set phone = new.phone where id = new.id;

  -- Same "first unclaimed match wins" rule as handle_new_user().
  select * into v_family_row from public.family_members
   where contact_phone = new.phone and linked_profile_id is null
   order by created_at asc limit 1;
  if found then
    update public.profiles set primary_account_id = v_family_row.account_id where id = new.id;
    update public.family_members set linked_profile_id = new.id where id = v_family_row.id;
  end if;

  update public.patient_leads set claimed_profile_id = new.id
   where phone = new.phone and claimed_profile_id is null;

  return new;
end; $$;

drop trigger if exists on_auth_user_phone_verified on auth.users;
create trigger on_auth_user_phone_verified after update of phone on auth.users
  for each row when (old.phone is null and new.phone is not null)
  execute function public.handle_user_phone_verified();
