-- ════════════════════════════════════════════════════════════════
--  Social backup — owner access policies for profiles / friends / messages
--  Run ONCE in the Supabase SQL editor. Idempotent. Run after
--  social_setup.sql and admin_backup_setup.sql.
--
--  By default, RLS limits the owner to friendship edges and messages that
--  involve the owner personally. For the admin panel's "Бэкап базы данных"
--  to cover EVERY user's social data (and to restore it after a disaster),
--  the owner account needs read and write access to all rows. These
--  policies grant exactly that to lypyotr@yandex.ru and no one else.
--
--  Without running this, the backup still works — it just contains only
--  the rows visible to the owner account.
--
--  Privacy note: message bodies are E2EE ciphertext ("m1.<iv>.<ct>"), so
--  this grants access to metadata and ciphertext, never to readable text.
--  user_keys deliberately stays owner-inaccessible (see e2ee_setup.sql).
-- ════════════════════════════════════════════════════════════════

drop policy if exists "profiles owner full access" on public.profiles;
create policy "profiles owner full access"
  on public.profiles for all
  using (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')
  with check (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');

drop policy if exists "friends owner full access" on public.friends;
create policy "friends owner full access"
  on public.friends for all
  using (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')
  with check (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');

drop policy if exists "messages owner full access" on public.messages;
create policy "messages owner full access"
  on public.messages for all
  using (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')
  with check (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');

-- These policies are ADDITIVE to the existing per-user policies, so regular
-- users keep exactly the same access as before.

notify pgrst, 'reload schema';
