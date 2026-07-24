-- ============================================================================
-- VAgeWell Care — 0007 Physio Therapy price correction
-- Client feedback (2026-07-24): Physio Therapy is Rs 1,500/day, not Rs 1,200.
-- Restores the GO-1 confirmed price. Supersedes the value seeded by 0006.
--
-- Existing bookings are unaffected by design: tg_booking_snapshot() copies
-- price_per_day onto the row at insert and the update guard freezes it, so
-- historical totals keep the price that was quoted at booking time.
-- Idempotent: safe to re-run.
-- ============================================================================

update public.services
   set price_per_day = 1500,
       updated_at    = now()
 where name = 'Physio Therapy'
   and price_per_day is distinct from 1500;
