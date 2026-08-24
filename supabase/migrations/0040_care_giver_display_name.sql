-- The self-select-role gate (0038) requires every Care Giver's `full_name`
-- to be the same fixed string ('VAgeWell_Care_cg', 0039) — which meant the
-- admin's Approve & Assign dropdown, which lists candidates by full_name,
-- showed every Care Giver as the identical generic string, with no way to
-- tell them apart. New `display_name` column holds the person's actual name
-- instead, collected as a separate signup field and shown in that dropdown
-- (only there, per what was asked) in place of full_name.

alter table public.profiles add column if not exists display_name text;

grant update (full_name, age, date_of_birth, gender, how_heard, wellness_note, address, avatar_path, emp_id, viewed_by_admin_at, display_name) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_age int; v_family_row public.family_members; v_role text; v_full_name text; v_display_name text;
begin
  if coalesce(new.raw_user_meta_data->>'age','') ~ '^\d+$'
    then v_age := (new.raw_user_meta_data->>'age')::int; else v_age := null; end if;
  v_role := nullif(new.raw_user_meta_data->>'requested_role','');
  v_full_name := nullif(new.raw_user_meta_data->>'full_name','');
  v_display_name := nullif(new.raw_user_meta_data->>'display_name','');
  if not (
    (v_role = 'admin'     and v_full_name = 'VAgeWell_Care_qcrah')
    or (v_role = 'leaf_node' and v_full_name = 'VAgeWell_Care_cg')
  ) then
    v_role := 'patient';
    -- display_name only ever means something for a genuinely-granted Care
    -- Giver identity (see AuthModal.tsx) — dropped for a downgraded signup so
    -- a stray/guessed value on a patient account can't masquerade as one.
    v_display_name := null;
  end if;
  insert into public.profiles (id, role, phone, full_name, display_name, age, gender, address, how_heard, wellness_note)
  values (new.id, v_role, new.phone,
          v_full_name, v_display_name, v_age,
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

    -- 0024: mark any matching pending lead(s) as claimed by this new account.
    update public.patient_leads set claimed_profile_id = new.id
     where phone = new.phone and claimed_profile_id is null;
  end if;
  return new;
end; $$;
