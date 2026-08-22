-- ============================================================================
-- VAgeWell Care — seed data (runs after migrations on `supabase db reset`).
-- ============================================================================

-- ── Service catalog ──────────────────────────────────────────────────────────
insert into public.services (name, description, price_per_day, pricing_model) values
  ('Nutrition',
   E'Diet adherence (supported by strategic meal provider partnerships).\n'
   '• Individualized diet planning & support\n'
   '• Ryles tube feeding guidance\n'
   '• Dietitian consultation',
   2000, 'flat_advance'),
  ('Physio Therapy',
   E'Exercise completion, mobility scores.\n'
   '• Mobility training\n'
   '• Post-surgery physio care\n'
   '• Therapeutic exercise',
   2000, 'flat_advance'),
  ('Para-Medical',
   E'Vitals Monitoring and medication compliance.\n'
   '• Vitals Monitoring (BP, Sugar, O2)\n'
   '• Elderly & geriatric care\n'
   '• Bedridden patient care\n'
   '• Wound & dressing care\n'
   '• Post-hospitalization care\n'
   '• 24/7 home nursing care',
   800, 'per_day'),
  ('Mental Wellbeing',
   E'Mood scores and social engagement tracking.\n'
   '• Elderly wellbeing support\n'
   '• Psychological support\n'
   '• Spiritual care\n'
   '• Rehabilitation / relaxation care',
   800, 'per_day')
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
