-- ============================================================================
-- VAgeWell Care — 0010 booking requests
-- Adds a lightweight "Request for Booking" — a quick contact-me lead a patient
-- can send without picking a service/date/time, surfaced to admin on the web
-- dashboard (pull-based — no push/SMS, same pattern as the removed R3.4 email
-- alert). Distinct from a real `bookings` row: no service, no payment, no
-- pipeline — just "please call me about booking care".
-- Assumes 0001–0009 already applied.
-- ============================================================================

create table if not exists public.booking_requests (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.profiles(id) on delete cascade,
  note         text,
  contacted    boolean not null default false,
  contacted_by uuid references public.profiles(id),
  contacted_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_booking_requests_account on public.booking_requests(account_id);

-- account_id is always the caller, never client-supplied (mirrors report_uploads'
-- uploaded_by stamp) — closes off spoofing another account's request.
create or replace function public.tg_booking_request_stamp() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.account_id := auth.uid();
  return new;
end; $$;
drop trigger if exists tg_booking_requests_before_insert on public.booking_requests;
create trigger tg_booking_requests_before_insert before insert on public.booking_requests
  for each row execute function public.tg_booking_request_stamp();

create or replace function public.mark_request_contacted(p_request uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.booking_requests
     set contacted = true, contacted_by = auth.uid(), contacted_at = now()
   where id = p_request;
  if not found then raise exception 'request not found' using errcode = 'P0001'; end if;
end; $$;
revoke all on function public.mark_request_contacted(uuid) from public, anon;
grant execute on function public.mark_request_contacted(uuid) to authenticated;

alter table public.booking_requests enable row level security;
alter table public.booking_requests force row level security;
grant select, insert on public.booking_requests to authenticated;

drop policy if exists booking_request_insert on public.booking_requests;
create policy booking_request_insert on public.booking_requests for insert to authenticated
  with check (account_id = auth.uid());
drop policy if exists booking_request_select on public.booking_requests;
create policy booking_request_select on public.booking_requests for select to authenticated
  using (account_id = auth.uid() or public.is_admin());
