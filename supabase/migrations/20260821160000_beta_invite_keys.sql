-- Closed-beta invite keys + Discord channel IDs for redemption

alter table public.discord_runtime_config
  add column if not exists beta_access_category_id text,
  add column if not exists beta_access_channel_id text,
  add column if not exists beta_embed_message_id text;

create table if not exists public.beta_invite_keys (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'unused'
    check (status in ('unused', 'redeemed', 'revoked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_discord_id text,
  redeemed_discord_username text,
  redeemed_discord_avatar_url text,
  game_code text check (game_code is null or game_code ~ '^\d{6}$'),
  fivem_account_id bigint,
  fivem_license text,
  fivem_discord text
);

create index if not exists beta_invite_keys_status_idx
  on public.beta_invite_keys (status, created_at desc);

create unique index if not exists beta_invite_keys_discord_redeemed_uidx
  on public.beta_invite_keys (redeemed_discord_id)
  where status = 'redeemed' and redeemed_discord_id is not null;

create unique index if not exists beta_invite_keys_game_code_redeemed_uidx
  on public.beta_invite_keys (game_code)
  where status = 'redeemed' and game_code is not null;

alter table public.beta_invite_keys enable row level security;

drop policy if exists "Admins read beta invite keys" on public.beta_invite_keys;
create policy "Admins read beta invite keys"
  on public.beta_invite_keys for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins insert beta invite keys" on public.beta_invite_keys;
create policy "Admins insert beta invite keys"
  on public.beta_invite_keys for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update beta invite keys" on public.beta_invite_keys;
create policy "Admins update beta invite keys"
  on public.beta_invite_keys for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
