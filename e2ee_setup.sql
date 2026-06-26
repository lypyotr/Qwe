-- ════════════════════════════════════════════════════════════════
--  E2EE setup — storage for client-side end-to-end encryption
--  Run ONCE in the Supabase SQL editor. Idempotent. Run security_setup.sql
--  first (RLS), then this.
--
--  Model: the browser encrypts period/settings contents with a random data
--  key (DEK). Only ciphertext reaches these columns. The DEK is wrapped by a
--  password-derived key AND a recovery-code-derived key, both stored (wrapped,
--  useless without the secret) in user_keys. Metadata (user_id, period_key,
--  updated_at) stays plaintext so sync + RLS keep working.
-- ════════════════════════════════════════════════════════════════

-- Ciphertext columns (data columns stay for the pre-E2EE / mixed state).
alter table public.periods       add column if not exists cipher text;
alter table public.user_settings add column if not exists cipher text;

-- Wrapped-key store: one row per user, plaintext metadata only (the wrapped
-- DEK cannot be unwrapped without the user's password or recovery code).
create table if not exists public.user_keys (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  blob       jsonb not null,
  updated_at timestamptz default now()
);

alter table public.user_keys enable row level security;
alter table public.user_keys force row level security;

drop policy if exists "user_keys_select_own" on public.user_keys;
drop policy if exists "user_keys_insert_own" on public.user_keys;
drop policy if exists "user_keys_update_own" on public.user_keys;
drop policy if exists "user_keys_delete_own" on public.user_keys;
drop policy if exists "user_keys owner full access" on public.user_keys;

create policy "user_keys_select_own" on public.user_keys
  for select using (auth.uid() = user_id);
create policy "user_keys_insert_own" on public.user_keys
  for insert with check (auth.uid() = user_id);
create policy "user_keys_update_own" on public.user_keys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_keys_delete_own" on public.user_keys
  for delete using (auth.uid() = user_id);

-- NOTE: deliberately NO owner-full-access policy here — nobody but the user
-- (not even the owner account) should be able to touch another user's key
-- material. The owner's backup of E2EE data will be ciphertext-only.
