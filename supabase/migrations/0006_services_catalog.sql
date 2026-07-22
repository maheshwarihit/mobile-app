-- ============================================================================
-- VAgeWell Care — 0006 services catalog swap
-- Replace the initial 6 placeholder services with the confirmed 4-service
-- catalog. Old rows can't be deleted (bookings.service_id is ON DELETE RESTRICT,
-- and each booking snapshots service_name/price_per_day anyway), so deactivate
-- them — the patient catalog lists active=true only — then upsert the new set.
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Retire the previous catalog (kept for referential history on old bookings).
update public.services set active = false, updated_at = now();

-- 2. Add / refresh the confirmed catalog.
insert into public.services (name, description, price_per_day, active) values
  ('Nutrition',        'Diet adherence (supported by strategic meal provider partnerships).', 800,  true),
  ('Physio Therapy',   'Exercise completion, mobility scores.',                               1200, true),
  ('Para-Medical',     'Vitals tracking (BP, Sugar, SpO2) and medication compliance.',        800,  true),
  ('Mental Wellbeing', 'Mood scores and social engagement tracking.',                         800,  true)
on conflict (name) do update
  set description   = excluded.description,
      price_per_day = excluded.price_per_day,
      active        = true,
      updated_at    = now();
