-- ============================================================================
-- ONE-TIME DESTRUCTIVE WIPE — deletes every account and everything tied to
-- them, so the app starts empty (e.g. before the public launch).
--
-- Deletes: all accounts (patients, Care Givers AND admins), family members,
-- bookings, booking requests, leads, vitals, reports, visit photos, nutrition
-- records and feedback.
-- Keeps:   the services catalog (public.services) and app settings.
--
-- Staff must sign up again afterwards from the "Care Giver / Admin" door.
--
-- Kept OUT of install_all.sql on purpose: that file is re-run on every schema
-- change, and a wipe there would erase real data each time. Run this file
-- manually, once, only when you really want to reset. There is no undo.
-- ============================================================================

do $$
declare
  t text;
begin
  -- Children before parents (several foreign keys are ON DELETE RESTRICT).
  -- Tables from migrations not yet run are skipped instead of failing.
  foreach t in array array[
    'visit_photos',       -- uploaded_by is ON DELETE RESTRICT
    'report_uploads',     -- uploaded_by is ON DELETE RESTRICT
    'clinical_records',   -- recorded_by is ON DELETE RESTRICT
    'nutrition_records',
    'feedback',
    'patient_leads',      -- created_by has no cascade
    'booking_requests',
    'bookings',           -- assigned_to has no cascade
    'family_members',
    'profiles'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
    end if;
  end loop;
  delete from auth.users;   -- nothing references it any more
end $$;

-- Confirm it worked — every number must be 0.
select
  (select count(*) from auth.users)       as users,
  (select count(*) from public.profiles)  as profiles,
  (select count(*) from public.bookings)  as bookings,
  (select count(*) from public.services)  as services_kept;

-- ----------------------------------------------------------------------------
-- Uploaded files are NOT removed by this script: Supabase blocks SQL deletes on
-- storage.objects (error 42501 "Use the Storage API instead"), and because the
-- SQL Editor runs everything as one transaction, that error would undo the
-- deletes above too. Empty these buckets in Dashboard → Storage (open the
-- bucket → select all → Delete):
--   payment-proofs, medical-reports, lab-report-files, nutrition-photos,
--   visit-photos, profile-photos, care-giver-payment-qr
-- Leave "payment-qr" (the company payment QR) unless you want to replace it.
-- ----------------------------------------------------------------------------
