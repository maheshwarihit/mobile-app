-- ============================================================================
-- VAgeWell Care — 0008 cancelled bookings are out of the payment workflow
-- Client feedback (2026-07-24): a cancelled appointment must not offer the
-- admin "Review / Mark as paid" or a pay-at-visit settlement.
--
-- 0002 gated both RPCs on payment_status alone, so a cancelled booking sitting
-- in 'pending_verification' or 'pay_at_visit' could still be settled. The UI now
-- hides those affordances; this closes the same hole at the data layer so the
-- two review entry points (dashboard card, payment-proofs module) cannot drift.
--
-- `create or replace` keeps the existing ACLs from 0002 — the revoke/grant block
-- is deliberately not repeated. Idempotent: safe to re-run.
-- ============================================================================

create or replace function public.verify_payment(p_booking uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;

  -- Distinguish "cancelled" from "wrong payment state" so the admin sees why.
  if exists (select 1 from public.bookings
              where id = p_booking and booking_status = 'cancelled') then
    raise exception 'booking is cancelled — payment cannot be verified'
      using errcode = 'P0001';
  end if;

  update public.bookings
     set payment_status = 'paid', payment_note = null
   where id = p_booking
     and payment_status in ('pending_verification','pay_at_visit')
     and booking_status <> 'cancelled';
  if not found then
    raise exception 'booking not in a verifiable state' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.reject_payment(p_booking uuid, p_reason text)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;

  if exists (select 1 from public.bookings
              where id = p_booking and booking_status = 'cancelled') then
    raise exception 'booking is cancelled — payment cannot be rejected'
      using errcode = 'P0001';
  end if;

  update public.bookings
     set payment_status = 'pending',
         payment_note = coalesce(nullif(p_reason,''), 'Rejected — please re-upload a valid proof.'),
         payment_proof_path = null
   where id = p_booking
     and payment_status = 'pending_verification'
     and booking_status <> 'cancelled';
  if not found then
    raise exception 'booking not awaiting verification' using errcode = 'P0001';
  end if;
end;
$$;
