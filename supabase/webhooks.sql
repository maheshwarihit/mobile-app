-- ============================================================================
-- VAgeWell Care — Database Webhook → notify-admin edge function (R3.4 / GR-7)
-- Run this ONCE, after the notify-admin function is deployed/served, filling in
-- the two placeholders. Kept OUT of the numbered migrations because the URL/key
-- are environment-specific (would break `supabase db reset`).
--
-- Easiest alternative: Studio → Database → Webhooks → "Create a new hook"
--   Table: public.bookings   Events: Insert, Update
--   Type: Supabase Edge Function → notify-admin
--
-- SQL setup (equivalent), using pg_net:
-- ----------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

create or replace function public.tg_notify_admin_booking()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fn_url     text := 'FUNCTIONS_BASE_URL/functions/v1/notify-admin';  -- <-- e.g. https://<ref>.supabase.co
  fn_key     text := 'SERVICE_ROLE_OR_ANON_KEY';                      -- <-- Authorization bearer for the fn
  fn_secret  text := 'NOTIFY_WEBHOOK_SECRET_VALUE';                   -- <-- must equal the fn's NOTIFY_WEBHOOK_SECRET
begin
  perform net.http_post(
    url     := fn_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || fn_key,
                 'x-webhook-secret', fn_secret
               ),
    body    := jsonb_build_object(
                 'type', tg_op,
                 'table', tg_table_name,
                 'record', to_jsonb(new),
                 'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
               )
  );
  return new;
end;
$$;

drop trigger if exists notify_admin_on_booking on public.bookings;
create trigger notify_admin_on_booking
  after insert or update on public.bookings
  for each row execute function public.tg_notify_admin_booking();
-- ============================================================================
