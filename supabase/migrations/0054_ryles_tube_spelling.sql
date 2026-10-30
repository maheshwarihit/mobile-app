-- =====================================================================
-- VAgeWell Care — 0054 Spelling fix: "Ryles tube" → "Ryle’s tube"
-- =====================================================================
-- In the Nutrition service description. Text only, nothing else changes.
--
-- Run once in the Supabase SQL editor, after 0053. Safe to re-run.
-- =====================================================================
update public.services
   set description = replace(description, 'Ryles tube', 'Ryle’s tube')
 where description like '%Ryles tube%';
