-- ════════════════════════════════════════════════════════════════
--  SECURITY SETUP — Row Level Security (RLS) for all user data
--  Run ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--  Safe to re-run: every statement is idempotent.
--
--  WHY THIS MATTERS
--  The web client ships a PUBLIC key (sb_publishable_…). That is by design —
--  the ONLY thing stopping anyone with that key from reading or deleting every
--  row in the database is RLS. With the policies below:
--    • a logged-in user can read/insert/update/delete ONLY their own rows;
--    • an anonymous caller (just the public key, no login) gets nothing;
--    • nobody can drop tables or wipe other users' data through the API.
--  (Encryption does NOT provide this — access control does.)
--
--  This file supersedes admin_backup_setup.sql (it also re-creates the owner
--  full-access policies used by the backup feature).
-- ════════════════════════════════════════════════════════════════

-- The owner account that may read/write ALL rows (for the admin backup feature).
-- Change this if the owner email ever changes.
-- (Used inline below as: auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')

-- ─────────────────────────────────────────────────────────────────
--  periods
-- ─────────────────────────────────────────────────────────────────
alter table public.periods enable row level security;
-- Force RLS even for the table owner role, closing a common bypass.
alter table public.periods force row level security;

drop policy if exists "periods_select_own"       on public.periods;
drop policy if exists "periods_insert_own"       on public.periods;
drop policy if exists "periods_update_own"       on public.periods;
drop policy if exists "periods_delete_own"       on public.periods;
drop policy if exists "periods owner full access" on public.periods;

create policy "periods_select_own" on public.periods
  for select using (auth.uid() = user_id);
create policy "periods_insert_own" on public.periods
  for insert with check (auth.uid() = user_id);
create policy "periods_update_own" on public.periods
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "periods_delete_own" on public.periods
  for delete using (auth.uid() = user_id);

-- Owner can read/write every row (needed for the full-database backup).
create policy "periods owner full access" on public.periods
  for all
  using      (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')
  with check (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');

-- ─────────────────────────────────────────────────────────────────
--  user_settings
-- ─────────────────────────────────────────────────────────────────
alter table public.user_settings enable row level security;
alter table public.user_settings force row level security;

drop policy if exists "user_settings_select_own"       on public.user_settings;
drop policy if exists "user_settings_insert_own"       on public.user_settings;
drop policy if exists "user_settings_update_own"       on public.user_settings;
drop policy if exists "user_settings_delete_own"       on public.user_settings;
drop policy if exists "user_settings owner full access" on public.user_settings;

create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings_delete_own" on public.user_settings
  for delete using (auth.uid() = user_id);

create policy "user_settings owner full access" on public.user_settings
  for all
  using      (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')
  with check (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');

-- ─────────────────────────────────────────────────────────────────
--  app_config (global announcement / maintenance — readable by all,
--  writable only by the owner)
-- ─────────────────────────────────────────────────────────────────
alter table public.app_config enable row level security;

drop policy if exists "app_config readable by all" on public.app_config;
drop policy if exists "app_config writable by owner" on public.app_config;

create policy "app_config readable by all" on public.app_config
  for select using (true);
create policy "app_config writable by owner" on public.app_config
  for all
  using      (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')
  with check (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');

-- ─────────────────────────────────────────────────────────────────
--  VERIFY (optional): run these to confirm RLS is ON and see policies.
-- ─────────────────────────────────────────────────────────────────
-- select relname, relrowsecurity, relforcerowsecurity
--   from pg_class where relname in ('periods','user_settings','app_config');
-- select tablename, policyname, cmd from pg_policies
--   where schemaname='public' order by tablename, policyname;
