-- =====================================================================
-- VAgeWell Care — 0051 BMI Check readings in nutrition_records
-- =====================================================================
-- Each BMI Check reading (the height and weight on a date, and the BMI
-- they give) is copied to nutrition_records as kind 'bmi', so the admin and
-- the patient's assigned Care Givers can see the BMI history as a graph.
-- The access rules from 0047 apply unchanged.
--
-- Run once in the Supabase SQL editor, after 0047. Safe to re-run.
-- =====================================================================
alter table public.nutrition_records drop constraint if exists nutrition_records_kind_check;
alter table public.nutrition_records
  add constraint nutrition_records_kind_check
  check (kind in ('body_metrics', 'meal', 'lab_report', 'self_assessment', 'bmi'));
