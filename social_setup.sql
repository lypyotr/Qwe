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
-- Trigger-only function: never expose it as a Data API RPC.
revoke all on function public.profiles_force_seq() from public, anon, authenticated;

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
alter table public.friends drop constraint if exists friends_no_self;
alter table public.friends add constraint friends_no_self
  check (user_id <> friend_id) not valid;
alter table public.friends drop constraint if exists friends_status_valid;
alter table public.friends add constraint friends_status_valid
  check (status in ('pending', 'accepted')) not valid;
create index if not exists friends_friend_id_idx on public.friends(friend_id);
alter table public.friends enable row level security;
drop policy if exists "friends_select" on public.friends;
drop policy if exists "friends_insert" on public.friends;
drop policy if exists "friends_update" on public.friends;
drop policy if exists "friends_delete" on public.friends;
-- I can see edges that involve me (either side).
create policy "friends_select" on public.friends for select to authenticated
  using ((select auth.uid()) = user_id or (select auth.uid()) = friend_id);
-- Direct clients may only create a pending request they own. Accepted edges are
-- created atomically by friend_request/friend_accept below.
create policy "friends_insert" on public.friends for insert to authenticated with check (
  (select auth.uid()) = user_id and user_id <> friend_id and status = 'pending'
);
-- Never allow a client UPDATE: a permissive update policy lets either party
-- rewrite user_id/friend_id and manufacture a friendship with a third party.
create policy "friends_delete" on public.friends for delete to authenticated
  using ((select auth.uid()) = user_id or (select auth.uid()) = friend_id);

create or replace function public.friend_request(target uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'authentication required'; end if;
  if target is null or target = me then raise exception 'invalid friend target'; end if;

  if exists (
    select 1 from public.friends
    where user_id = target and friend_id = me and status = 'pending'
  ) then
    update public.friends set status = 'accepted'
      where user_id = target and friend_id = me;
    insert into public.friends(user_id, friend_id, status)
      values (me, target, 'accepted')
      on conflict (user_id, friend_id) do update set status = 'accepted';
  else
    insert into public.friends(user_id, friend_id, status)
      values (me, target, 'pending')
      on conflict (user_id, friend_id) do nothing;
  end if;
end;
$$;

create or replace function public.friend_accept(requester uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'authentication required'; end if;
  update public.friends set status = 'accepted'
    where user_id = requester and friend_id = me and status = 'pending';
  if not found then raise exception 'pending request not found'; end if;
  insert into public.friends(user_id, friend_id, status)
    values (me, requester, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
end;
$$;

revoke all on function public.friend_request(uuid) from public;
revoke all on function public.friend_accept(uuid) from public;
revoke all on function public.friend_request(uuid) from anon;
revoke all on function public.friend_accept(uuid) from anon;
grant execute on function public.friend_request(uuid) to authenticated;
grant execute on function public.friend_accept(uuid) to authenticated;

-- ── Messages. Body is ciphertext (ECDH-derived AES-GCM), unreadable server-side.
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  sender     uuid not null references auth.users(id) on delete cascade,
  recipient  uuid not null references auth.users(id) on delete cascade,
  body       text not null,             -- "m1.<iv>.<ct>"
  created_at timestamptz default now()
);
alter table public.messages add column if not exists client_id uuid;
alter table public.messages add column if not exists read_at timestamptz;
drop index if exists public.messages_sender_client_uidx;
create unique index messages_sender_client_uidx
  on public.messages(sender, client_id);
create index if not exists messages_pair_idx on public.messages(sender, recipient, created_at);
create index if not exists messages_recipient_idx on public.messages(recipient);
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

-- Read receipts are updated through a narrow RPC so recipients can never
-- rewrite ciphertext, sender, recipient or timestamps.
create or replace function public.message_mark_read(peer uuid)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  me uuid := auth.uid();
  changed integer;
begin
  if me is null then raise exception 'authentication required'; end if;
  update public.messages
     set read_at = coalesce(read_at, now())
   where recipient = me and sender = peer and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.message_mark_read(uuid) from public, anon;
grant execute on function public.message_mark_read(uuid) to authenticated;

notify pgrst, 'reload schema';
