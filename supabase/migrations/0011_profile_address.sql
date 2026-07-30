-- ============================================================================
-- VAgeWell Care — 0011 profile address
-- Adds a free-text address to profiles, captured at registration (mirrors how
-- age/gender/wellness_note already flow through auth metadata → handle_new_user).
-- Assumes 0001–0010 already applied.
-- ============================================================================

alter table public.profiles add column if not exists address text;

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_age int; v_family_row public.family_members;
begin
  if coalesce(new.raw_user_meta_data->>'age','') ~ '^\d+$'
    then v_age := (new.raw_user_meta_data->>'age')::int; else v_age := null; end if;
  insert into public.profiles (id, role, phone, full_name, age, gender, address, how_heard, wellness_note)
  values (new.id, 'patient', new.phone,
          nullif(new.raw_user_meta_data->>'full_name',''), v_age,
          nullif(new.raw_user_meta_data->>'gender',''),
          nullif(new.raw_user_meta_data->>'address',''),
          coalesce(nullif(new.raw_user_meta_data->>'how_heard',''),'web_search'),
          nullif(new.raw_user_meta_data->>'wellness_note',''))
  on conflict (id) do nothing;

  -- First unclaimed family_members row with a matching contact_phone wins
  -- (documented limitation if the same number appears under multiple accounts).
  if new.phone is not null then
    select * into v_family_row from public.family_members
     where contact_phone = new.phone and linked_profile_id is null
     order by created_at asc limit 1;
    if found then
      update public.profiles set primary_account_id = v_family_row.account_id where id = new.id;
      update public.family_members set linked_profile_id = new.id where id = v_family_row.id;
    end if;
  end if;
  return new;
end; $$;
