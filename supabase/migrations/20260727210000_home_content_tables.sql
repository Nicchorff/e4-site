-- Home CMS tables (Fase 2) — admin CRUD in Fase 5

create table public.site_content (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table public.site_stats (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value integer not null default 0,
  suffix text not null default '',
  display_order int not null default 0
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  body text not null,
  displayed_at date not null default current_date,
  display_order int not null default 0,
  is_active boolean not null default true
);

create index site_stats_order_idx on public.site_stats (display_order);
create index testimonials_active_order_idx on public.testimonials (is_active, display_order);

alter table public.site_content enable row level security;
alter table public.site_stats enable row level security;
alter table public.testimonials enable row level security;

create policy "Public read site_content"
  on public.site_content for select to anon, authenticated using (true);

create policy "Admin write site_content"
  on public.site_content for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Public read site_stats"
  on public.site_stats for select to anon, authenticated using (true);

create policy "Admin write site_stats"
  on public.site_stats for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Public read active testimonials"
  on public.testimonials for select to anon, authenticated
  using (is_active = true);

create policy "Admin write testimonials"
  on public.testimonials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.site_content (key, value) values
  ('hero_headline', 'RP Pokémon no FiveM, do jeito elite.'),
  ('hero_subtitle', 'Entre no servidor, vive o roleplay e fortaleça seu time na Elite Four.'),
  ('rules_teaser_1', 'Respeite todos os jogadores — toxicidade e bullying não têm lugar aqui.'),
  ('rules_teaser_2', 'Mantenha o RP: meta-gaming e power-gaming quebram a imersão.'),
  ('rules_teaser_3', 'Proibido RDM/VDM e ações sem justificativa de personagem.'),
  ('rules_teaser_4', 'Compras da loja são digitais e seguem as regras de entrega in-game.');

insert into public.site_stats (label, value, suffix, display_order) values
  ('Membros no Discord', 1200, '+', 1),
  ('Jogadores na cidade', 85, '', 2),
  ('Itens na loja', 40, '+', 3);

insert into public.testimonials (author_name, body, displayed_at, display_order, is_active) values
  ('Luna', 'Melhor servidor de Pokémon RP que já joguei. A vibe GBA é demais.', '2026-06-12', 1, true),
  ('Rafa', 'Staff atenciosa e a loja entrega rápido. Recomendo o VIP.', '2026-06-28', 2, true),
  ('Kai', 'A comunidade é acolhedora — entrei pelo Discord e fiquei.', '2026-07-05', 3, true),
  ('Mika', 'Captura, RP e eventos: tudo encaixa. E4 virou minha casa.', '2026-07-18', 4, true);
