-- Discord onboarding "Sem WL" role, removed when Aprovado is granted

alter table public.discord_runtime_config
  add column if not exists pending_role_id text;
