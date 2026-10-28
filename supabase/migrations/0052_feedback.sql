-- =====================================================================
-- VAgeWell Care — 0052 Patient feedback
-- =====================================================================
-- The feedback button on the Services screen (next to the call button):
-- a star rating (1–5) and an optional message. The patient can send and
-- see only their own; the admin sees everyone's (admin → Feedback).
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  -- Always the signed-in account (set by the default; RLS rejects anything else).
  account_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  message     text check (message is null or char_length(message) <= 2000),
  created_at  timestamptz not null default now()
);
create index if not exists idx_feedback_created on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (account_id = auth.uid());

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select to authenticated
  using (account_id = auth.uid() or public.is_admin());

-- No update: feedback is kept as sent. Admin may delete.
drop policy if exists feedback_delete on public.feedback;
create policy feedback_delete on public.feedback
  for delete to authenticated
  using (public.is_admin());

grant select, insert, delete on public.feedback to authenticated;
