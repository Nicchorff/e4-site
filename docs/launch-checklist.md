# Checklist de lançamento — Elite Four (E4)

Marque cada item antes de considerar o site em produção. Domínio: use `https://SEU_DOMINIO` até ter o real.

## Conteúdo (admin)

- [ ] Hero / teasers / stats revisados em `/admin/conteudo`
- [ ] Regras publicadas em `/admin/regras` e ok em `/regras`
- [ ] Catálogo e destaques em `/admin/loja`
- [ ] Depoimentos ativos em `/admin/depoimentos`
- [ ] Links Discord / redes no `.env` / build args

## Auth Discord

- [ ] OAuth app: redirect `https://dppyamtmjzmmkzjlmiew.supabase.co/auth/v1/callback`
- [ ] Supabase Auth → Discord: Client ID/Secret
- [ ] Redirect allow list: `https://SEU_DOMINIO/auth/discord/callback` (+ localhost se ainda testar)
- [ ] Bot no servidor + intent Server Members
- [ ] Secrets: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_ADMIN_ROLE_ID`, `DISCORD_STAFF_ROLE_ID`
- [ ] Login Discord → badge admin aparece para quem tem o cargo

Guia: [discord-bot-setup.md](./discord-bot-setup.md)

## Stripe / loja

- [ ] `STRIPE_SECRET_KEY` (test → live quando for o go-live)
- [ ] Webhook `checkout.session.completed` → `https://dppyamtmjzmmkzjlmiew.supabase.co/functions/v1/stripe-webhook`
- [ ] `STRIPE_WEBHOOK_SECRET` = signing secret do endpoint
- [ ] `SITE_URL=https://SEU_DOMINIO`
- [ ] Compra de teste (cartão `4242…` em test mode) → order `paid` + `deliveries` pending
- [ ] Pix / métodos BR revisados no Dashboard Stripe (opcional)

Guia: [stripe-store-setup.md](./stripe-store-setup.md)

## FiveM

- [ ] `FIVEM_API_KEY` nos secrets das Edge Functions
- [ ] `config.lua` do resource com a mesma key + `ApiBaseUrl` das functions
- [ ] `ensure elite4-delivery` no `server.cfg`
- [ ] `ApplyDelivery` adaptado ao framework do servidor

## Segurança

- [ ] Client só tem `VITE_*` públicos (sem service role / Stripe secret) — verificado na Fase 7
- [ ] RLS ativo nas tabelas públicas; pedidos só do próprio user; deliveries sem escrita client
- [ ] Advisors Supabase revisados (WARNs de `is_admin` / `current_profile_role` são **intencionais** para RLS)
- [ ] Auth → leaked password protection habilitado no Dashboard (recomendado; Discord OAuth é o fluxo principal)
- [ ] HTTPS no domínio (EasyPanel / proxy)

## SEO / performance

- [ ] `VITE_SITE_URL=https://SEU_DOMINIO` no build
- [ ] `public/sitemap.xml` e `public/robots.txt` com domínio real
- [ ] Hero webm gerado se Lighthouse home <90 — [hero-media.md](./hero-media.md)
- [ ] Lighthouse mobile em `/`, `/regras`, `/loja` (meta ≥90 a11y; performance após webm)

## Deploy

- [ ] Build Docker com build-args Vite — [deploy-easypanel.md](./deploy-easypanel.md)
- [ ] DNS A/CNAME → VPS / EasyPanel
- [ ] Smoke pós-deploy: home, login Discord, loja, carrinho, `/admin`

## Checkpoint Fase 7

- [x] Código: Docker ARG/ENV, nginx headers, docs de checklist/deploy
- [ ] Domínio real apontado (ação humana)
- [ ] Keys Stripe live (ação humana)
- [ ] Conteúdo final assinado pelo time
