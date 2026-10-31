-- =====================================================================
-- VAgeWell Care — 0055 Spelling: "Ryle's tube" with a plain apostrophe
-- =====================================================================
-- In the Nutrition service description. Fixes the old "Ryles tube" and
-- the curly "Ryle’s tube" from 0054. Text only, nothing else changes.
--
-- Run once in the Supabase SQL editor (0054 is not needed). Safe to re-run.
-- =====================================================================
update public.services
   set description = replace(replace(description, 'Ryles tube', 'Ryle''s tube'), 'Ryle’s tube', 'Ryle''s tube')
 where description like '%Ryles tube%' or description like '%Ryle’s tube%';
