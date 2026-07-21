-- ============================================================================
-- VAgeWell Care — seed data (runs after migrations on `supabase db reset`).
-- ============================================================================

-- ── Service catalog (GO-1) — placeholder prices except Physiotherapy ─────────
insert into public.services (name, description, price_per_day) values
  ('Physiotherapy',        'In-home physiotherapy session by a licensed therapist.', 1500),
  ('Nursing Care',         'Home nursing and bedside care for recovering patients.', 1200),
  ('Elderly Attendant',    'Daily attendant support for elderly household members.',  900),
  ('Post-Surgical Care',   'Post-operative recovery, dressing and wound care.',       1800),
  ('Doctor Home Visit',    'Physician consultation at your home.',                    2000),
  ('Lab Sample Collection','At-home collection of pathology samples.',                 500)
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
--    and u.phone = '+919000000001';   -- <-- founding admin's verified phone (E.164)
