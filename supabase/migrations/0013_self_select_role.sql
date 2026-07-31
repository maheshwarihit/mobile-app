-- ============================================================================
-- 0013: self-selected role at signup (web staff portal registration)
-- ============================================================================
-- User decision (explicit, informed of the trade-off): a brand-new phone
-- number registering on the web staff portal now picks its own role
-- (Staff / Admin / Leaf Node) and gets it immediately on signup — no admin
-- approval step. This intentionally reopens the project's earlier "no
-- self-service elevated roles" rule. It is enforced only in
-- `handle_new_user()`, which fires exactly once per brand-new `auth.users`
-- row — an already-existing account has no way to invoke this path again to
-- escalate itself later; only account CREATION can set a role this way.
--
-- Residual, accepted risk: `requested_role` is read from client-supplied
-- signup metadata, so it isn't specific to the web UI's picker — any brand
-- new signup (including via the mobile app or a direct Auth API call) that
-- includes `requested_role: 'admin'` in its metadata will also land as
-- admin immediately. The mobile app's own Register screen never sends this
-- field, so ordinary patient signups are unaffected in practice, but the
-- door is technically open to anyone crafting the request themselves.

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_age int; v_family_row public.family_members; v_role text;
begin
  if coalesce(new.raw_user_meta_data->>'age','') ~ '^\d+$'
    then v_age := (new.raw_user_meta_data->>'age')::int; else v_age := null; end if;

  v_role := nullif(new.raw_user_meta_data->>'requested_role','');
  if v_role is null or v_role not in ('staff','admin','leaf_node') then
    v_role := 'patient';
  end if;

  insert into public.profiles (id, role, phone, full_name, age, gender, address, how_heard, wellness_note)
  values (new.id, v_role, new.phone,
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
