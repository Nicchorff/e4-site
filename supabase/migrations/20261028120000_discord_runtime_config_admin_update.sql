-- Site admins edit Discord role/channel IDs from /admin/discord

drop policy if exists "Admins update discord runtime config" on public.discord_runtime_config;
create policy "Admins update discord runtime config"
  on public.discord_runtime_config for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
