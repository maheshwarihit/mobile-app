-- =====================================================================
-- VAgeWell Care — 0048 Height and weight on the profile
-- =====================================================================
-- Height (cm) and weight (kg) are now part of a person's profile — the
-- account holder's (profiles) and each family member's (family_members) —
-- and required in the app's profile forms. The Nutrition modules (BMI,
-- Body Metrics, Food Plate Monitor) read them from here instead of asking
-- separately. Nullable in the database so existing rows stay valid; the
-- app asks people who have not filled them in yet.
--
-- Run once in the Supabase SQL editor (safe to re-run).
-- =====================================================================
alter table public.profiles       add column if not exists height_cm numeric(5,1);
alter table public.profiles       add column if not exists weight_kg numeric(5,1);
alter table public.family_members add column if not exists height_cm numeric(5,1);
alter table public.family_members add column if not exists weight_kg numeric(5,1);

alter table public.profiles drop constraint if exists profiles_height_range;
alter table public.profiles add constraint profiles_height_range check (height_cm is null or height_cm between 50 and 250);
alter table public.profiles drop constraint if exists profiles_weight_range;
alter table public.profiles add constraint profiles_weight_range check (weight_kg is null or weight_kg between 2 and 400);
alter table public.family_members drop constraint if exists family_height_range;
alter table public.family_members add constraint family_height_range check (height_cm is null or height_cm between 50 and 250);
alter table public.family_members drop constraint if exists family_weight_range;
alter table public.family_members add constraint family_weight_range check (weight_kg is null or weight_kg between 2 and 400);
