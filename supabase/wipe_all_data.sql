-- ============================================================================
-- ONE-TIME DESTRUCTIVE WIPE — deletes every account and everything tied to
-- them (bookings, reports, vitals, dependents, requests, uploaded files).
--
-- This is deliberately kept OUT of install_all.sql. That file is meant to be
-- re-run repeatedly every time a schema change is applied — if a wipe like
-- this lived there, every future re-run would erase all real data again.
-- Run this file manually, once, only when you actually want to reset
-- everything from scratch. There is no undo.
-- ============================================================================

delete from public.report_uploads;      -- uploaded_by is ON DELETE RESTRICT
delete from public.clinical_records;    -- recorded_by is ON DELETE RESTRICT
delete from public.booking_requests;
delete from public.bookings;            -- assigned_to has no cascade
delete from public.family_members;
delete from public.profiles;
delete from auth.users;                 -- now nothing references it

-- storage.objects is protected against direct SQL deletion (Supabase raises
-- 42501 "Use the Storage API instead") — this used to sit right after the
-- line above in the same script, and because the SQL Editor runs a pasted
-- block as one transaction, that error rolled back every delete before it
-- too, including auth.users. That's why nothing appeared to change on every
-- earlier attempt. Clear the payment-proofs/medical-reports buckets from the
-- Supabase Dashboard's Storage tab instead (select all → delete) if you want
-- those files gone too — it's optional cleanup, unreferenced files there are
-- harmless either way.

-- Confirm it actually worked — must read 0.
select count(*) as remaining_users from auth.users;
