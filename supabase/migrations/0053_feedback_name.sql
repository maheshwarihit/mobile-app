-- =====================================================================
-- VAgeWell Care — 0053 Patient name (and phone) on each feedback row
-- =====================================================================
-- So the person is easy to find in Table Editor → feedback without
-- looking up account_id. Filled in automatically from their profile
-- when the feedback is sent (the app does not send them).
--
-- Postgres can't move a column, so the table is rebuilt with the columns
-- in this order — id, account_id, name, phone, rating, message,
-- created_at — keeping every existing row (their name and phone are
-- filled in from the profiles). Same rules as 0052: app users can only
-- add feedback; nobody reads it through the app.
--
-- Run once in the Supabase SQL editor, after 0052. Safe to re-run.
-- =====================================================================
begin;

create table if not exists public.feedback_new (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text,
  phone       text,
  rating      smallint not null check (rating between 1 and 5),
  message     text check (message is null or char_length(message) <= 2000),
  created_at  timestamptz not null default now()
);

-- Only on the first run (a re-run finds the table already rebuilt).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'feedback' and column_name = 'name'
  ) then
    insert into public.feedback_new (id, account_id, name, phone, rating, message, created_at)
    select f.id, f.account_id, p.full_name, p.phone, f.rating, f.message, f.created_at
    from public.feedback f
    left join public.profiles p on p.id = f.account_id;
    drop table public.feedback;
    alter table public.feedback_new rename to feedback;
    alter index if exists feedback_new_pkey rename to feedback_pkey;
  else
    drop table public.feedback_new;
  end if;
end $$;

create index if not exists idx_feedback_created on public.feedback (created_at desc);

-- The sender's name and phone, copied from their profile (not trusted from the app).
create or replace function public.tg_feedback_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.account_id := auth.uid();
  select full_name, phone into new.name, new.phone from public.profiles where id = new.account_id;
  return new;
end;
$$;

drop trigger if exists tg_feedback_before_insert on public.feedback;
create trigger tg_feedback_before_insert
  before insert on public.feedback
  for each row execute function public.tg_feedback_stamp();

alter table public.feedback enable row level security;

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (account_id = auth.uid());

drop policy if exists feedback_select on public.feedback;
drop policy if exists feedback_delete on public.feedback;
revoke all on public.feedback from authenticated, anon;
grant insert on public.feedback to authenticated;

commit;
