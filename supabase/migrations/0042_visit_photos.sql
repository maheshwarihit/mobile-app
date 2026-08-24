-- Mandatory GPS-tagged "Care Giver with patient" photo, required before a
-- booking can be marked completed. Deliberately a separate table from
-- report_uploads, not a new report_type on it: this is an internal
-- ops-verification artifact (proof the visit actually happened, where),
-- never a document meant for the customer to see — report_uploads'
-- reviewed/report_select machinery (household visibility once released) is
-- the wrong shape for it, so visit_photos stays is_staff()-only, always.

create table if not exists public.visit_photos (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  uploaded_by  uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null,
  latitude     double precision,
  longitude    double precision,
  created_at   timestamptz not null default now()
);
create index if not exists idx_visit_photos_booking on public.visit_photos(booking_id);

create or replace function public.tg_visit_photo_stamp() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.uploaded_by := auth.uid();
  return new;
end; $$;
drop trigger if exists tg_visit_photos_before_insert on public.visit_photos;
create trigger tg_visit_photos_before_insert before insert on public.visit_photos
  for each row execute function public.tg_visit_photo_stamp();

alter table public.visit_photos enable row level security;
alter table public.visit_photos force row level security;
grant select, insert on public.visit_photos to authenticated;

drop policy if exists visit_photo_select on public.visit_photos;
create policy visit_photo_select on public.visit_photos for select to authenticated using (public.is_staff());
drop policy if exists visit_photo_insert on public.visit_photos;
create policy visit_photo_insert on public.visit_photos for insert to authenticated with check (public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos','visit-photos', false, 5242880, array['image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists visit_photo_file_insert on storage.objects;
create policy visit_photo_file_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'visit-photos' and public.is_staff());
drop policy if exists visit_photo_file_select on storage.objects;
create policy visit_photo_file_select on storage.objects for select to authenticated
  using (bucket_id = 'visit-photos' and public.is_staff());

-- Hard gate: completing a visit now requires at least one visit_photos row
-- for that booking, enforced here (not just in the app) so it can't be
-- bypassed by calling the API directly. Applies regardless of whether the
-- assigned Care Giver or an admin is the one clicking Complete.
create or replace function public.tg_booking_update_guard() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.account_id is distinct from old.account_id
  or new.family_member_id is distinct from old.family_member_id
  or new.service_id is distinct from old.service_id
  or new.service_name is distinct from old.service_name
  or new.price_per_day is distinct from old.price_per_day
  or new.pricing_model is distinct from old.pricing_model
  or new.num_days is distinct from old.num_days
  or new.start_date is distinct from old.start_date
  or new.time_slot is distinct from old.time_slot
  or new.payment_method is distinct from old.payment_method then
    raise exception 'immutable booking field changed' using errcode = '42501';
  end if;

  if new.payment_proof_path is distinct from old.payment_proof_path and old.payment_status = 'paid' then
    raise exception 'cannot change payment proof after settlement' using errcode = '42501';
  end if;
  if new.payment_proof_path is not null and old.payment_proof_path is null
     and old.payment_status = 'pending' and new.payment_method = 'online' then
    new.payment_status := 'pending_verification';
  end if;
  if new.payment_status is distinct from old.payment_status then
    if public.is_staff() then null;
    elsif old.payment_status = 'pending' and new.payment_status = 'pending_verification' then null;
    else raise exception 'illegal payment_status transition' using errcode = '42501'; end if;
  end if;

  if new.service_mode is distinct from old.service_mode and not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is not null then
      if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
      if new.service_mode is null then
        raise exception 'service_mode must be set before assignment' using errcode = '23514';
      end if;
      if not exists (select 1 from public.profiles where id = new.assigned_to and role = 'leaf_node') then
        raise exception 'assigned_to must be a leaf_node member' using errcode = '23514';
      end if;
    elsif not public.is_admin() then
      raise exception 'admin only' using errcode = '42501';
    end if;
  end if;

  if new.booking_status is distinct from old.booking_status then
    if new.booking_status = 'completed'
       and not exists (select 1 from public.visit_photos where booking_id = new.id) then
      raise exception 'a visit photo (Care Giver with patient) is required before completing' using errcode = '23514';
    end if;
    if new.booking_status = 'cancelled' then
      if public.is_staff() then
        if old.booking_status = 'completed' then
          raise exception 'cannot cancel a completed booking' using errcode = '42501';
        end if;
      elsif not (old.booking_status in ('requested','approved') and old.account_id = auth.uid()) then
        raise exception 'illegal booking_status transition' using errcode = '42501';
      end if;
    elsif old.booking_status = 'requested' and new.booking_status in ('approved','assigned') then
      if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
    elsif old.booking_status = 'approved' and new.booking_status = 'assigned' then
      if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
    elsif old.booking_status = 'assigned' and new.booking_status = 'in_progress' then
      if not (auth.uid() = old.assigned_to or public.is_admin()) then
        raise exception 'assigned member or admin only' using errcode = '42501'; end if;
    elsif old.booking_status = 'in_progress' and new.booking_status in ('report_uploaded','completed') then
      if not (auth.uid() = old.assigned_to or public.is_admin()) then
        raise exception 'assigned member or admin only' using errcode = '42501'; end if;
    elsif old.booking_status = 'report_uploaded' and new.booking_status = 'completed' then
      if not (auth.uid() = old.assigned_to or public.is_admin()) then
        raise exception 'assigned member or admin only' using errcode = '42501'; end if;
    else
      raise exception 'illegal booking_status transition' using errcode = '42501';
    end if;
  end if;

  return new;
end; $$;
