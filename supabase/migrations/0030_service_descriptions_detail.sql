-- ============================================================================
-- VAgeWell Care — 0030 Service descriptions gain a bullet list of what's
-- included, under the existing one-line summary. Client-supplied copy
-- (2026-08-19), light typo cleanup only (spelling/wording, no content change).
--
-- Existing bookings are unaffected: tg_booking_snapshot() only ever copies
-- service_name onto a booking row, never description — nothing downstream of
-- this column changes shape or meaning, just its display text. Idempotent:
-- safe to re-run.
-- ============================================================================

update public.services
   set description = case name
         when 'Nutrition' then
           E'Diet adherence (supported by strategic meal provider partnerships).\n'
           '• Individualized diet planning & support\n'
           '• Ryles tube feeding guidance\n'
           '• Dietitian consultation'
         when 'Physio Therapy' then
           E'Exercise completion, mobility scores.\n'
           '• Mobility training\n'
           '• Post-surgery physio care\n'
           '• Therapeutic exercise'
         when 'Para-Medical' then
           E'Vitals tracking (BP, Sugar, SpO2) and medication compliance.\n'
           '• Vital monitoring\n'
           '• Elderly & geriatric care\n'
           '• Bedridden patient care\n'
           '• Wound & dressing care\n'
           '• Post-hospitalization care\n'
           '• 24/7 home nursing care'
         when 'Mental Wellbeing' then
           E'Mood scores and social engagement tracking.\n'
           '• Elderly wellbeing support\n'
           '• Psychological support\n'
           '• Spiritual care\n'
           '• Rehabilitation / relaxation care'
         else description
       end,
       updated_at = now()
 where name in ('Nutrition', 'Physio Therapy', 'Para-Medical', 'Mental Wellbeing');
