-- ════════════════════════════════════════════════════════════════
--  Sequential public user numbers (#1, #2, #3, …)
--  Run ONCE in the Supabase SQL editor. Idempotent.
--
--  auth.users ids are random UUIDs, so we keep a separate ascending number
--  assigned on first login. The owner is pinned to #1; everyone else gets the
--  next number in registration order.
-- ════════════════════════════════════════════════════════════════

-- #1 is reserved for the owner, so new users start at #2.
create sequence if not exists public.user_seq start with 2;

create table if not exists public.user_numbers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  seq        int unique not null default nextval('public.user_seq'),
  created_at timestamptz default now()
);

-- Owner (lypyotr@yandex.ru) is #1.
insert into public.user_numbers(user_id, seq)
  values ('4e0678c2-277d-4de7-afb7-988714e41d0f', 1)
  on conflict (user_id) do nothing;

alter table public.user_numbers enable row level security;

drop policy if exists "user_numbers_select_own" on public.user_numbers;
drop policy if exists "user_numbers_insert_own" on public.user_numbers;
drop policy if exists "user_numbers owner read all" on public.user_numbers;

-- Each user can read and create only their own number (seq comes from the
-- column default, not from the client).
create policy "user_numbers_select_own" on public.user_numbers
  for select using (auth.uid() = user_id);
create policy "user_numbers_insert_own" on public.user_numbers
  for insert with check (auth.uid() = user_id);
-- Owner may read everyone's number (e.g. for a future user list).
create policy "user_numbers owner read all" on public.user_numbers
  for select using (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');

-- Let the REST API see the new table immediately.
notify pgrst, 'reload schema';
