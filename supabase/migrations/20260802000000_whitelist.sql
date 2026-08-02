-- Whitelist applications via Discord threads + site admin

create table if not exists public.whitelist_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whitelist_questions_active_order_idx
  on public.whitelist_questions (active, sort_order);

create table if not exists public.whitelist_embed_settings (
  id int primary key default 1 check (id = 1),
  title text not null default '🔥 Whitelist Elite Four',
  subtitle text not null default '⚡ Formulário automático!',
  description text not null default E'» Responda as perguntas com sinceridade.\n🚨 • Código do jogo obrigatório (6 dígitos).',
  image_url text,
  button_label text not null default 'Fazer formulário',
  embed_message_id text,
  updated_at timestamptz not null default now()
);

insert into public.whitelist_embed_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.whitelist_applications (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  discord_username text not null default '',
  discord_avatar_url text,
  game_code text not null check (game_code ~ '^\d{6}$'),
  status text not null default 'in_progress'
    check (status in (
      'in_progress',
      'pending_review',
      'interview',
      'approved',
      'rejected_form',
      'rejected_interview'
    )),
  discord_thread_id text,
  current_question_index int not null default 0,
  last_bot_message_id text,
  reject_reason text,
  reviewed_at timestamptz,
  interviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whitelist_applications_discord_idx
  on public.whitelist_applications (discord_id);
create index if not exists whitelist_applications_status_idx
  on public.whitelist_applications (status);
create index if not exists whitelist_applications_thread_idx
  on public.whitelist_applications (discord_thread_id);

create table if not exists public.whitelist_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.whitelist_applications(id) on delete cascade,
  question_id uuid references public.whitelist_questions(id) on delete set null,
  question_prompt text not null,
  answer_text text not null,
  answered_at timestamptz not null default now()
);

create index if not exists whitelist_answers_app_idx
  on public.whitelist_answers (application_id);

alter table public.whitelist_questions enable row level security;
alter table public.whitelist_embed_settings enable row level security;
alter table public.whitelist_applications enable row level security;
alter table public.whitelist_answers enable row level security;

-- Questions: admin CRUD
drop policy if exists "Admin read whitelist questions" on public.whitelist_questions;
drop policy if exists "Admin write whitelist questions" on public.whitelist_questions;
create policy "Admin read whitelist questions"
  on public.whitelist_questions for select to authenticated
  using (public.is_admin());
create policy "Admin write whitelist questions"
  on public.whitelist_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Embed settings: admin CRUD
drop policy if exists "Admin read whitelist embed" on public.whitelist_embed_settings;
drop policy if exists "Admin write whitelist embed" on public.whitelist_embed_settings;
create policy "Admin read whitelist embed"
  on public.whitelist_embed_settings for select to authenticated
  using (public.is_admin());
create policy "Admin write whitelist embed"
  on public.whitelist_embed_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Applications: admin read only (writes via service role)
drop policy if exists "Admin read whitelist applications" on public.whitelist_applications;
create policy "Admin read whitelist applications"
  on public.whitelist_applications for select to authenticated
  using (public.is_admin());

-- Answers: admin read only
drop policy if exists "Admin read whitelist answers" on public.whitelist_answers;
create policy "Admin read whitelist answers"
  on public.whitelist_answers for select to authenticated
  using (public.is_admin());
