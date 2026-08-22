-- 0038: the self-select-role signup door (0013 — "Caregiver / Admin" ->
-- Sign up, requested_role in the OTP metadata) now also requires the
-- signed-up full_name to exactly match a fixed, agreed team identity:
-- 'VAgeWell_Care_qcrah' for Admin, 'VAgeWell_Care_ln' for Leaf Node (Care
-- Assistant). Anyone requesting either role under any other name falls
-- through to 'patient', same as an unrecognized role value already did.
--
-- This is a coordination gate, not real authentication — the name is
-- visible/guessable, not a secret credential — but it does stop a stranger
-- from picking "Admin" on the signup form and getting it instantly, which
-- the self-select door otherwise allowed unconditionally since 0013.

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_age int; v_family_row public.family_members; v_role text; v_full_name text;
begin
  if coalesce(new.raw_user_meta_data->>'age','') ~ '^\d+$'
    then v_age := (new.raw_user_meta_data->>'age')::int; else v_age := null; end if;
  v_role := nullif(new.raw_user_meta_data->>'requested_role','');
  v_full_name := nullif(new.raw_user_meta_data->>'full_name','');
  if not (
    (v_role = 'admin'        and v_full_name = 'VAgeWell_Care_qcrah')
    or (v_role = 'leaf_node' and v_full_name = 'VAgeWell_Care_ln')
  ) then
    v_role := 'patient';
  end if;
  insert into public.profiles (id, role, phone, full_name, age, gender, address, how_heard, wellness_note)
  values (new.id, v_role, new.phone,
          v_full_name, v_age,
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

    update public.patient_leads set claimed_profile_id = new.id
     where phone = new.phone and claimed_profile_id is null;
  end if;
  return new;
end; $$;
-- Trigger itself is unchanged (still after insert on auth.users); this
-- migration only replaces the function body.
