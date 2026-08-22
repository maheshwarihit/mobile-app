-- 0035: Para-Medical's summary line and first bullet reworded from
-- "Vitals/Vital tracking" to "Vitals/Vital Monitoring" (both already say
-- "(BP, Sugar, O2)", per 0034).

update public.services
set description =
  E'Vitals Monitoring (BP, Sugar, O2) and medication compliance.\n'
  '• Vital Monitoring (BP, Sugar, O2)\n'
  '• Elderly & geriatric care\n'
  '• Bedridden patient care\n'
  '• Wound & dressing care\n'
  '• Post-hospitalization care\n'
  '• 24/7 home nursing care',
    updated_at = now()
where name = 'Para-Medical';
