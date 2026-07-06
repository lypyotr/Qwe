-- ════════════════════════════════════════════════════════════════
--  Realtime Authorization — private sync channels
--  Run ONCE in the Supabase SQL editor. Idempotent. Run after
--  social_setup.sql (needs public.friends).
--
--  WHY
--  Live cross-device sync and instant new-message "pings" travel over Realtime
--  BROADCAST channels named  user-sync-<uid>.  By default broadcast channels are
--  NOT gated by RLS: any authenticated user could subscribe to another user's
--  channel (metadata leak — who is active, who messages whom, and when) or send
--  a forged ping (fake "new message"). No message CONTENT leaks — a ping only
--  triggers a re-fetch from the RLS-protected tables — but the metadata and
--  spoofing are worth closing.
--
--  MODEL
--    • Each user OWNS the channel  'user-sync-' || their uid.
--    • RECEIVE on it: their own devices' "data-updated" + friends' "msg" pings.
--    • SEND "data-updated" to their OWN channel (their other devices), and a
--      "msg" ping to an ACCEPTED FRIEND's channel.
--
--  ACTIVATION
--    1. Supabase Dashboard → Realtime → enable "Realtime Authorization" (private
--       channels) for the project if it isn't already.
--    2. Run this file.
--  The web client already opens these channels with config:{ private:true }.
--
--  SAFE TO DEPLOY BEFORE RUNNING THIS: Realtime is only a latency optimization.
--  If a private subscribe is denied (policies not applied yet), the app silently
--  falls back to its focus/visibility/online/45s-poll refresh and the 4s chat
--  poll — data is never lost or stale for long, it just updates a bit slower.
-- ════════════════════════════════════════════════════════════════

alter table realtime.messages enable row level security;

drop policy if exists "user_sync_receive" on realtime.messages;
drop policy if exists "user_sync_send"    on realtime.messages;

-- RECEIVE (subscribe): only your own channel — nobody can read your pings.
create policy "user_sync_receive" on realtime.messages
  for select to authenticated
  using (
    realtime.topic() = 'user-sync-' || (select auth.uid())::text
  );

-- SEND (broadcast): to your own channel, or to an ACCEPTED friend's channel
-- (the instant new-message ping). A stranger can no longer ping arbitrary users.
--
-- NOTE: if your Supabase version requires read access to *join* a channel
-- before broadcasting to it, the friend-ping path will fall back to the 4s chat
-- poll (messages still arrive, just not instantly) — this is intentional and
-- keeps a friend from reading your channel. If you'd rather have instant pings
-- and accept that accepted-friends can read your sync channel, add the same
-- friend clause to the receive policy above.
create policy "user_sync_send" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and (
      realtime.topic() = 'user-sync-' || (select auth.uid())::text
      or exists (
        select 1 from public.friends f
        where f.user_id = (select auth.uid())
          and 'user-sync-' || f.friend_id::text = realtime.topic()
          and f.status = 'accepted'
      )
    )
  );
