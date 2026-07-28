-- Donation tickets via Discord (temporary checkout without Stripe UI)

alter table public.orders
  add column if not exists payment_method text not null default 'discord_ticket'
  check (payment_method in ('stripe', 'discord_ticket'));

create table if not exists public.donation_ticket_settings (
  id int primary key default 1 check (id = 1),
  viewer_role_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.donation_ticket_settings (id, viewer_role_ids)
values (1, '{}')
on conflict (id) do nothing;

create table if not exists public.donation_tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  discord_channel_id text not null unique,
  discord_message_id text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'finished')),
  claimed_by_discord_id text,
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists donation_tickets_user_idx on public.donation_tickets (user_id);
create index if not exists donation_tickets_status_idx on public.donation_tickets (status);
create index if not exists donation_tickets_channel_idx on public.donation_tickets (discord_channel_id);

alter table public.donation_ticket_settings enable row level security;
alter table public.donation_tickets enable row level security;

drop policy if exists "Public read donation settings" on public.donation_ticket_settings;
drop policy if exists "Admin write donation settings" on public.donation_ticket_settings;
create policy "Public read donation settings"
  on public.donation_ticket_settings for select to anon, authenticated
  using (true);
create policy "Admin write donation settings"
  on public.donation_ticket_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users read own donation tickets" on public.donation_tickets;
drop policy if exists "Admin read all donation tickets" on public.donation_tickets;
create policy "Users read own donation tickets"
  on public.donation_tickets for select to authenticated
  using (auth.uid() = user_id);
create policy "Admin read all donation tickets"
  on public.donation_tickets for select to authenticated
  using (public.is_admin());
-- inserts/updates via service role only (Edge Functions)
