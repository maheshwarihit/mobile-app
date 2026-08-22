-- 0033: Para-Medical's first bullet reworded from the generic "Vital
-- monitoring" to the more specific "Vital tracking (BP, Sugar, SpO2)",
-- mirroring the summary line's own parenthetical detail.

update public.services
set description =
  E'Vitals tracking (BP, Sugar, SpO2) and medication compliance.\n'
  '• Vital tracking (BP, Sugar, SpO2)\n'
  '• Elderly & geriatric care\n'
  '• Bedridden patient care\n'
  '• Wound & dressing care\n'
  '• Post-hospitalization care\n'
  '• 24/7 home nursing care',
    updated_at = now()
where name = 'Para-Medical';
