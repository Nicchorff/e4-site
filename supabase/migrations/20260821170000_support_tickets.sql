-- Support tickets (dúvida / suporte / reporte) + public Discord panel channel

alter table public.discord_runtime_config
  add column if not exists ticket_panel_channel_id text,
  add column if not exists ticket_panel_embed_message_id text;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('duvida', 'suporte', 'reporte')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'finished')),
  discord_user_id text not null,
  discord_username text not null default '',
  user_id uuid references auth.users (id) on delete set null,
  subject text not null,
  body text not null default '',
  discord_channel_id text not null unique,
  discord_message_id text,
  claimed_by_discord_id text,
  claimed_at timestamptz,
  finished_at timestamptz,
  finished_by_discord_id text,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, created_at desc);

create index if not exists support_tickets_user_idx
  on public.support_tickets (discord_user_id, created_at desc);

create unique index if not exists support_tickets_one_active_per_user_uidx
  on public.support_tickets (discord_user_id)
  where status in ('open', 'in_progress');

alter table public.support_tickets enable row level security;

drop policy if exists "Admins read support tickets" on public.support_tickets;
create policy "Admins read support tickets"
  on public.support_tickets for select to authenticated
  using (public.is_admin());
-- inserts/updates via service role only (Edge Functions)
