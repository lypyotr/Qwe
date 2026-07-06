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
-- Bound the client-writable text fields so a crafted client can't store a huge
-- name/pubkey (storage abuse). NOT VALID: enforce on new writes without failing
-- the migration on any pre-existing oversized row.
alter table public.profiles drop constraint if exists profiles_name_len;
alter table public.profiles add constraint profiles_name_len
  check (char_length(coalesce(name,'')) <= 80) not valid;
alter table public.profiles drop constraint if exists profiles_pubkey_len;
alter table public.profiles add constraint profiles_pubkey_len
  check (pubkey is null or char_length(pubkey) <= 256) not valid;

alter table public.profiles enable row level security;
drop policy if exists "profiles_read_all"  on public.profiles;
drop policy if exists "profiles_upsert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_read_all"   on public.profiles for select to authenticated using (true);
create policy "profiles_upsert_own" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Anti-spoofing: the #number in the public directory must NOT be trusted from
-- the client. RLS above only checks user_id, so a malicious client could upsert
-- its own profile with seq = 1 (the owner's number) or any other user's number,
-- impersonating them in friend search — and duplicate seqs also break the
-- .maybeSingle() lookup. This trigger overwrites whatever seq the client sends
-- with the authoritative value from user_numbers (assigned server-side), so the
-- directory number can never be forged. SECURITY DEFINER lets it read
-- user_numbers regardless of that table's RLS.
create or replace function public.profiles_force_seq()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  select seq into new.seq from public.user_numbers where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists profiles_force_seq_trg on public.profiles;
create trigger profiles_force_seq_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_force_seq();

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
-- Cap the ciphertext size (a 4000-char message encrypts to ~5.5 KB of base64);
-- 16 KB leaves headroom while blocking multi-MB junk rows. NOT VALID so the
-- migration never fails on an existing row.
alter table public.messages drop constraint if exists messages_body_len;
alter table public.messages add constraint messages_body_len
  check (char_length(body) <= 16000) not valid;
alter table public.messages enable row level security;
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;
drop policy if exists "messages_delete" on public.messages;
create policy "messages_select" on public.messages for select using (auth.uid() = sender or auth.uid() = recipient);
-- A message may only be sent by its own sender AND only to an accepted friend.
-- Without the friendship check, any authenticated user could write rows to any
-- recipient (unsolicited messages / storage abuse). The app only ever opens a
-- chat with an accepted friend, so this matches real usage.
create policy "messages_insert" on public.messages for insert with check (
  auth.uid() = sender
  and exists (
    select 1 from public.friends f
    where f.user_id = sender
      and f.friend_id = recipient
      and f.status = 'accepted'
  )
);
-- «Удалить у всех» — только автор может удалить своё сообщение с сервера.
-- («Удалить у себя» серверу не нужно: это локальный скрытый список устройства.)
create policy "messages_delete" on public.messages for delete using (auth.uid() = sender);

notify pgrst, 'reload schema';
