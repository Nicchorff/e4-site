create table if not exists public.discord_runtime_config (
  id int primary key default 1 check (id = 1),
  guild_id text,
  admin_role_id text,
  staff_role_id text,
  category_open_id text,
  category_in_progress_id text,
  category_finished_id text,
  wl_form_channel_id text,
  wl_thread_channel_id text,
  wl_result_form_channel_id text,
  wl_result_interview_channel_id text,
  interview_role_id text,
  approved_role_id text,
  invite_url text,
  updated_at timestamptz not null default now()
);

alter table public.discord_runtime_config enable row level security;

drop policy if exists "Admins read discord runtime config" on public.discord_runtime_config;
create policy "Admins read discord runtime config"
  on public.discord_runtime_config for select to authenticated
  using (public.is_admin());

insert into public.discord_runtime_config (id)
values (1)
on conflict (id) do nothing;
