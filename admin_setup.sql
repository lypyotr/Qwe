-- ════════════════════════════════════════════════════════════════
--  Admin panel — global config table
--  Run this ONCE in the Supabase SQL editor for the project.
--  Stores the single shared config row the app reads for everyone:
--  global announcement + maintenance mode.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.app_config (
  id                  int primary key default 1,
  announcement        text    default '',
  announcement_active boolean default false,
  maintenance         boolean default false,
  maintenance_msg     text    default '',
  updated_at          timestamptz default now()
);

-- Single canonical row.
insert into public.app_config (id) values (1)
  on conflict (id) do nothing;

-- Realtime so every client reacts instantly to changes.
alter publication supabase_realtime add table public.app_config;

-- Row Level Security: everyone may READ, only the owner account may WRITE.
alter table public.app_config enable row level security;

create policy "app_config readable by all"
  on public.app_config for select
  using (true);

create policy "app_config writable by owner"
  on public.app_config for all
  using (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru')
  with check (auth.jwt() ->> 'email' = 'lypyotr@yandex.ru');
