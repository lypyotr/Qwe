-- ════════════════════════════════════════════════════════════════
--  Social: public profile directory + friends + encrypted messages
--  Run ONCE in the Supabase SQL editor. Idempotent. Run after
--  user_numbers_setup.sql (numbers) and security_setup.sql (RLS).
-- ════════════════════════════════════════════════════════════════

-- ── Public directory: lets you find a person by their #number and read the
-- name + ECDH public key needed to add them and send E2EE messages. Only the
-- name/#/pubkey are exposed — never salary data.
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  seq        int,                       -- the person's #number
  name       text default '',
  pubkey     text,                      -- ECDH P-256 public key (base64 raw)
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_read_all"  on public.profiles;
drop policy if exists "profiles_upsert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_read_all"   on public.profiles for select to authenticated using (true);
create policy "profiles_upsert_own" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Friendship edges. Adding a friend inserts a 'pending' edge from me to them;
-- when they accept, their edge becomes 'accepted' and a reciprocal edge is made.
create table if not exists public.friends (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,   -- edge owner
  friend_id  uuid not null references auth.users(id) on delete cascade,   -- the other side
  status     text not null default 'pending',                            -- pending | accepted
  created_at timestamptz default now(),
  unique (user_id, friend_id)
);
alter table public.friends enable row level security;
drop policy if exists "friends_select" on public.friends;
drop policy if exists "friends_insert" on public.friends;
drop policy if exists "friends_update" on public.friends;
drop policy if exists "friends_delete" on public.friends;
-- I can see edges that involve me (either side).
create policy "friends_select" on public.friends for select using (auth.uid() = user_id or auth.uid() = friend_id);
-- I can only create edges I own; and can accept a request by inserting the reciprocal edge.
create policy "friends_insert" on public.friends for insert with check (auth.uid() = user_id);
-- Either party may update the edge status (e.g. the recipient accepting).
create policy "friends_update" on public.friends for update using (auth.uid() = user_id or auth.uid() = friend_id) with check (auth.uid() = user_id or auth.uid() = friend_id);
create policy "friends_delete" on public.friends for delete using (auth.uid() = user_id or auth.uid() = friend_id);

-- ── Messages. Body is ciphertext (ECDH-derived AES-GCM), unreadable server-side.
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  sender     uuid not null references auth.users(id) on delete cascade,
  recipient  uuid not null references auth.users(id) on delete cascade,
  body       text not null,             -- "m1.<iv>.<ct>"
  created_at timestamptz default now()
);
create index if not exists messages_pair_idx on public.messages(sender, recipient, created_at);
alter table public.messages enable row level security;
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;
create policy "messages_select" on public.messages for select using (auth.uid() = sender or auth.uid() = recipient);
create policy "messages_insert" on public.messages for insert with check (auth.uid() = sender);

notify pgrst, 'reload schema';
