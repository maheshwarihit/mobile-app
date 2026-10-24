-- =====================================================================
-- VAgeWell Care — 0047 Care Givers see only their assigned patients;
--                     Nutrition records shared with the care team
-- =====================================================================
-- 1. Until now "staff" (admin AND Care Giver, see is_staff()) could read
--    every patient's profile, family, bookings, clinical records, visit
--    reports, visit photos and payment screenshots. From here a Care Giver
--    only sees a household they have at least one booking assigned to;
--    the admin still sees everything; patients still see their own household.
-- 2. The Nutrition modules (Body Metrics, Food Plate Monitor meals, Bio
--    Markers lab report readings, General Health Self-Assessment) were kept
--    on the patient's phone only. They are now also saved here, readable by
--    the household, the admin and that household's assigned Care Givers.
--
-- Run once in the Supabase SQL editor (safe to re-run).
-- =====================================================================

-- ── The one rule: who may see a household's data ─────────────────────
create or replace function public.can_view_account(p_account_id uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select p_account_id is not null and (
    public.in_household(p_account_id)
    or public.is_admin()
    or (public.is_staff() and exists (
      select 1 from public.bookings b
      where b.assigned_to = auth.uid()
        and (
          b.account_id = p_account_id
          -- the same household: one of the two is the other's primary account
          or b.account_id = (select primary_account_id from public.profiles where id = p_account_id)
          or p_account_id = (select primary_account_id from public.profiles where id = b.account_id)
        )
    ))
  );
$$;
revoke all on function public.can_view_account(uuid) from public, anon;
grant execute on function public.can_view_account(uuid) to authenticated;

-- Storage folders are named by account id; anything that isn't a uuid is simply not visible.
create or replace function public.can_view_folder(p_folder text) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then public.can_view_account(p_folder::uuid) else false end;
$$;
revoke all on function public.can_view_folder(text) from public, anon;
grant execute on function public.can_view_folder(text) to authenticated;

-- ── Profiles ──────────────────────────────────────────────────────────
-- Staff also see each other (names on visits, the team list).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.can_view_account(id)
    or (public.is_staff() and role in ('admin', 'leaf_node'))
  );

-- ── Family members ───────────────────────────────────────────────────
drop policy if exists fam_select on public.family_members;
create policy fam_select on public.family_members for select to authenticated
  using (public.can_view_account(account_id));
drop policy if exists fam_insert on public.family_members;
create policy fam_insert on public.family_members for insert to authenticated
  with check (public.can_view_account(account_id));
drop policy if exists fam_update on public.family_members;
create policy fam_update on public.family_members for update to authenticated
  using (public.can_view_account(account_id))
  with check (public.can_view_account(account_id));
drop policy if exists fam_delete on public.family_members;
create policy fam_delete on public.family_members for delete to authenticated
  using (public.can_view_account(account_id));

-- ── Bookings (writes unchanged: see 0009 bk_update / 0018 bk_insert) ────
drop policy if exists bk_select on public.bookings;
create policy bk_select on public.bookings for select to authenticated
  using (public.can_view_account(account_id) or assigned_to = auth.uid());

-- ── Clinical records ─────────────────────────────────────────────────
drop policy if exists clin_select on public.clinical_records;
create policy clin_select on public.clinical_records for select to authenticated
  using (
    public.can_view_account(profile_id)
    or family_member_id in (select id from public.family_members where public.can_view_account(account_id))
  );
drop policy if exists clin_write_staff on public.clinical_records;
create policy clin_write_staff on public.clinical_records for all to authenticated
  using (
    public.is_admin()
    or (public.is_staff() and (
      public.can_view_account(profile_id)
      or family_member_id in (select id from public.family_members where public.can_view_account(account_id))
    ))
  )
  with check (
    public.is_admin()
    or (public.is_staff() and (
      public.can_view_account(profile_id)
      or family_member_id in (select id from public.family_members where public.can_view_account(account_id))
    ))
  );

-- ── Visit reports (report_uploads) ───────────────────────────────────
drop policy if exists report_select on public.report_uploads;
create policy report_select on public.report_uploads for select to authenticated
  using (
    public.is_admin()
    or (public.is_staff() and exists (
      select 1 from public.bookings b where b.id = report_uploads.booking_id and public.can_view_account(b.account_id)
    ))
    or (reviewed and exists (
      select 1 from public.bookings b where b.id = report_uploads.booking_id and public.in_household(b.account_id)
    ))
  );
drop policy if exists report_insert on public.report_uploads;
create policy report_insert on public.report_uploads for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_staff() and exists (
      select 1 from public.bookings b where b.id = report_uploads.booking_id and public.can_view_account(b.account_id)
    ))
  );

drop policy if exists report_file_select on storage.objects;
create policy report_file_select on storage.objects for select to authenticated
  using (
    bucket_id = 'medical-reports'
    and (
      public.is_admin()
      or exists (
        select 1 from public.report_uploads r
        join public.bookings b on b.id = r.booking_id
        where r.storage_path = storage.objects.name
          and (
            (public.is_staff() and public.can_view_account(b.account_id))
            or (r.reviewed and public.in_household(b.account_id))
          )
      )
    )
  );

-- ── Visit photos ─────────────────────────────────────────────────────
drop policy if exists visit_photo_select on public.visit_photos;
create policy visit_photo_select on public.visit_photos for select to authenticated
  using (
    public.is_admin()
    or (public.is_staff() and exists (
      select 1 from public.bookings b where b.id = visit_photos.booking_id and public.can_view_account(b.account_id)
    ))
  );
drop policy if exists visit_photo_file_select on storage.objects;
create policy visit_photo_file_select on storage.objects for select to authenticated
  using (
    bucket_id = 'visit-photos'
    and (
      public.is_admin()
      or (public.is_staff() and exists (
        select 1 from public.visit_photos v
        join public.bookings b on b.id = v.booking_id
        where v.storage_path = storage.objects.name and public.can_view_account(b.account_id)
      ))
    )
  );

-- ── Payment screenshots (folder 1 = the patient's account id) ──────────
drop policy if exists pay_proof_select on storage.objects;
create policy pay_proof_select on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and public.can_view_folder((storage.foldername(name))[1]));
drop policy if exists pay_proof_update on storage.objects;
create policy pay_proof_update on storage.objects for update to authenticated
  using (bucket_id = 'payment-proofs' and public.can_view_folder((storage.foldername(name))[1]));
drop policy if exists pay_proof_delete on storage.objects;
create policy pay_proof_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs' and public.can_view_folder((storage.foldername(name))[1]));

-- =====================================================================
-- Nutrition records
-- =====================================================================
create table if not exists public.nutrition_records (
  id               uuid primary key default gen_random_uuid(),
  -- The household account the record belongs to (the signed-in patient).
  account_id       uuid not null references public.profiles(id) on delete cascade,
  -- Null: the account holder themselves; otherwise one of their family members.
  family_member_id uuid references public.family_members(id) on delete cascade,
  kind             text not null check (kind in ('body_metrics', 'meal', 'lab_report', 'self_assessment')),
  -- The app's own id for the record, so a save replaces and a delete removes the same row.
  client_id        text not null,
  data             jsonb not null,
  -- A small picture in the nutrition-photos bucket (meal photo, first report page).
  photo_path       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (account_id, client_id)
);
create index if not exists idx_nutrition_person on public.nutrition_records (account_id, family_member_id, kind, created_at desc);

alter table public.nutrition_records enable row level security;
grant select, insert, update, delete on public.nutrition_records to authenticated;

drop policy if exists nutrition_select on public.nutrition_records;
create policy nutrition_select on public.nutrition_records for select to authenticated
  using (public.can_view_account(account_id));
-- Only the household writes its own records; the care team reads them.
drop policy if exists nutrition_insert on public.nutrition_records;
create policy nutrition_insert on public.nutrition_records for insert to authenticated
  with check (public.in_household(account_id));
drop policy if exists nutrition_update on public.nutrition_records;
create policy nutrition_update on public.nutrition_records for update to authenticated
  using (public.in_household(account_id)) with check (public.in_household(account_id));
drop policy if exists nutrition_delete on public.nutrition_records;
create policy nutrition_delete on public.nutrition_records for delete to authenticated
  using (public.in_household(account_id));

-- Pictures: private bucket, folder 1 = account id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nutrition-photos', 'nutrition-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists nutrition_photo_select on storage.objects;
create policy nutrition_photo_select on storage.objects for select to authenticated
  using (bucket_id = 'nutrition-photos' and public.can_view_folder((storage.foldername(name))[1]));
drop policy if exists nutrition_photo_insert on storage.objects;
create policy nutrition_photo_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'nutrition-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists nutrition_photo_update on storage.objects;
create policy nutrition_photo_update on storage.objects for update to authenticated
  using (bucket_id = 'nutrition-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists nutrition_photo_delete on storage.objects;
create policy nutrition_photo_delete on storage.objects for delete to authenticated
  using (bucket_id = 'nutrition-photos' and (storage.foldername(name))[1] = auth.uid()::text);
