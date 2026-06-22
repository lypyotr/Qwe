-- ════════════════════════════════════════════════════════════════
--  Full-database backup — owner access policies
--  Run ONCE in the Supabase SQL editor.
--
--  By default, RLS limits each user to their OWN rows in `periods` and
--  `user_settings`. For the admin panel's "Бэкап базы данных" to cover
--  EVERY user (not just the owner's rows), the owner account needs read
--  and write access to all rows. These policies grant exactly that to
--  lypyotr@yandex.ru and no one else.
--
--  Without running this, the backup still works — it just contains only
--  the owner's own data.
-- ════════════════════════════════════════════════════════════════

-- periods: owner can read & write every row
drop policy if exists "periods owner full access" on public.periods;
create policy "periods owner full access"
  on public.periods for all
  using (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')
  with check (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');

-- user_settings: owner can read & write every row
drop policy if exists "user_settings owner full access" on public.user_settings;
create policy "user_settings owner full access"
  on public.user_settings for all
  using (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')
  with check (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');

-- NOTE: these policies are ADDITIVE to the existing per-user policies, so
-- regular users keep access to their own data exactly as before.
