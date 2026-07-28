create table public.rules_sections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  body_md text not null,
  display_order int not null default 0,
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

create index rules_sections_order_idx on public.rules_sections (display_order);
create index rules_sections_published_idx on public.rules_sections (is_published, display_order);

create or replace function public.set_rules_sections_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rules_sections_set_updated_at
before update on public.rules_sections
for each row execute function public.set_rules_sections_updated_at();

alter table public.rules_sections enable row level security;

create policy "Public read published rules"
  on public.rules_sections for select
  to anon, authenticated
  using (is_published = true);

create policy "Admin select all rules"
  on public.rules_sections for select
  to authenticated
  using (public.is_admin());

create policy "Admin insert rules"
  on public.rules_sections for insert
  to authenticated
  with check (public.is_admin());

create policy "Admin update rules"
  on public.rules_sections for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete rules"
  on public.rules_sections for delete
  to authenticated
  using (public.is_admin());

insert into public.rules_sections (slug, title, body_md, display_order, is_published) values
(
  'geral',
  'Geral',
  E'## Conduta\n\n- Respeite todos os jogadores e a staff.\n- Toxicidade, bullying e discriminação resultam em punição.\n- Use o Discord oficial para suporte e denúncias.\n\n## Conta\n\n- Cada jogador é responsável pela própria conta.\n- Compartilhar conta é por sua conta e risco.',
  1,
  true
),
(
  'rp',
  'RP',
  E'## Roleplay\n\n- Mantenha o personagem consistente.\n- Meta-gaming e power-gaming quebram a imersão e são proibidos.\n- Fear RP e valor à vida devem ser respeitados.\n\n## Comunicação\n\n- Prefira voz/texto in-character quando possível.\n- OOC deve ser claramente marcado quando necessário.',
  2,
  true
),
(
  'pvp',
  'PVP',
  E'## Conflitos\n\n- RDM e VDM são proibidos.\n- Inicie ações com justificativa de personagem.\n- Após um confronto, respeite o tempo de cool-down definido pela staff.\n\n## Zonas\n\n- Áreas seguras (se houver) devem ser respeitadas.',
  3,
  true
),
(
  'loja',
  'Loja / Compras',
  E'## Produtos digitais\n\n- Itens da loja são digitais e destinados ao uso in-game.\n- Benefícios VIP e pacotes seguem a descrição no momento da compra.\n\n## Entrega e suporte\n\n- A entrega ocorre via sistema do servidor (plugin/webhook).\n- Problemas de entrega: abra ticket no Discord com comprovante.\n- Chargebacks indevidos podem resultar em banimento.',
  4,
  true
);
