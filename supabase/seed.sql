-- ============================================================================
-- VAgeWell Care — seed data (runs after migrations on `supabase db reset`).
-- ============================================================================

-- ── Service catalog ──────────────────────────────────────────────────────────
insert into public.services (name, description, price_per_day, pricing_model) values
  ('Nutrition',        'Diet adherence (supported by strategic meal provider partnerships).', 2000, 'flat_advance'),
  ('Physio Therapy',   'Exercise completion, mobility scores.',                               2000, 'flat_advance'),
  ('Para-Medical',     'Vitals tracking (BP, Sugar, SpO2) and medication compliance.',        800,  'per_day'),
  ('Mental Wellbeing', 'Mood scores and social engagement tracking.',                         800,  'per_day')
on conflict (name) do nothing;

-- ── Founding admin bootstrap ────────────────────────────────────────────────
-- Self-registration only ever mints role='patient'. To create the first admin:
--   1. Register normally via OTP with the phone below (dev test number works).
--   2. Uncomment + set the phone, then re-run `supabase db reset` (or run this
--      UPDATE in the SQL editor — it executes as `postgres`, bypassing RLS/grants).
--   3. Thereafter the admin promotes staff/admin in-app via set_user_role().
--
-- update public.profiles p
--    set role = 'admin', updated_at = now()
--   from auth.users u
--  where u.id = p.id
--    and replace(u.phone, '+', '') = '919000000001';  -- founding admin's phone (no '+':
--                                                       -- GoTrue stores phone without it)
