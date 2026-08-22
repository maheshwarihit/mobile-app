-- 0036: Para-Medical's "(BP, Sugar, O2)" detail moved off the summary line
-- (now plain "Vitals Monitoring and medication compliance.") and onto the
-- first bullet only ("Vitals Monitoring (BP, Sugar, O2)"), removing the
-- redundant duplicate across both lines.

update public.services
set description =
  E'Vitals Monitoring and medication compliance.\n'
  '• Vitals Monitoring (BP, Sugar, O2)\n'
  '• Elderly & geriatric care\n'
  '• Bedridden patient care\n'
  '• Wound & dressing care\n'
  '• Post-hospitalization care\n'
  '• 24/7 home nursing care',
    updated_at = now()
where name = 'Para-Medical';
