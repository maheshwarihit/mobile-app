-- 0034: Para-Medical's "SpO2" reworded to the simpler "O2" in both the
-- summary line and its first bullet.

update public.services
set description =
  E'Vitals tracking (BP, Sugar, O2) and medication compliance.\n'
  '• Vital tracking (BP, Sugar, O2)\n'
  '• Elderly & geriatric care\n'
  '• Bedridden patient care\n'
  '• Wound & dressing care\n'
  '• Post-hospitalization care\n'
  '• 24/7 home nursing care',
    updated_at = now()
where name = 'Para-Medical';
