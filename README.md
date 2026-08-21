# Elite Four (E4) — Site

Site público + loja + painel admin do servidor FiveM Elite Four.

Especificação: [PRD-Elite-Four-Site.md](./PRD-Elite-Four-Site.md).

## Stack

- Vite + React + TypeScript + Tailwind CSS v4
- shadcn/ui + SmoothUI + Unlumen UI
- Supabase Auth (Discord) + Edge Functions
- Stripe Checkout (catálogo/pedidos no Supabase)
- React Router · Docker / nginx (EasyPanel)

## Setup local

```bash
cp .env.example .env
pnpm install
pnpm dev
```

### 1. Discord OAuth no Supabase

Guia completo (criar Application, Bot, intents, invite, IDs e secrets):  
**[docs/discord-bot-setup.md](./docs/discord-bot-setup.md)**

Resumo rápido:

1. Crie um app em [Discord Developer Portal](https://discord.com/developers/applications) → OAuth2 + Bot.
2. Redirect URL: `https://dppyamtmjzmmkzjlmiew.supabase.co/auth/v1/callback`
3. No Supabase → Authentication → Providers → Discord: cole Client ID e Secret.
4. Redirect allow list do Auth: `http://localhost:5173/auth/discord/callback` (e o domínio de produção depois).

### 2. Secrets da Edge Function `sync-discord-roles`

No Dashboard → Edge Functions → Secrets:

| Secret | Uso |
|---|---|
| `DISCORD_BOT_TOKEN` | Token do bot E4 (leitura de membros) |
| `DISCORD_GUILD_ID` | ID do servidor (opcional se o bot já gravou `discord_runtime_config`) |
| `DISCORD_ADMIN_ROLE_ID` | Cargo → `role = admin` (idem) |
| `DISCORD_STAFF_ROLE_ID` | Cargo → `role = staff` (idem) |

Troca de servidor: convide o bot existente, rode `npm run setup-guild` em `discord-bot/` (ou suba o app no EasyPanel). O bot cria cargos/canais e grava os IDs. Deploy EasyPanel: [docs/deploy-easypanel.md](docs/deploy-easypanel.md) (`docker-compose.easypanel.yml`).

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem no runtime das functions.

O bot precisa da intent **Server Members** (ou permissão de ver membros) no servidor.

### 3. Frontend `.env`

```env
VITE_SUPABASE_URL=https://dppyamtmjzmmkzjlmiew.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_SITE_URL=http://localhost:5173
```

### 4. Loja — tickets Discord (atual) + Stripe (código)

Checkout na UI: **Abrir ticket** → canal Discord. Guia: **[docs/discord-donation-tickets.md](./docs/discord-donation-tickets.md)**.

Stripe permanece no código para reativar depois: **[docs/stripe-store-setup.md](./docs/stripe-store-setup.md)**.

Resource FiveM stub: `fivem-resource/elite4-delivery/`.

### Pendente — configurar antes de testar checkout

Cole estes valores quando tiver as chaves (compra real não funciona sem eles):

**Frontend (`.env`)**

| Variável | Uso |
|---|---|
| `VITE_SITE_URL` | Base do site (success/cancel redirect) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Cliente Supabase |
| `VITE_DISCORD_INVITE_URL` | CTA Discord (+ `VITE_INSTAGRAM_URL` / `VITE_TIKTOK_URL` opcional) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Opcional — Checkout redirect não exige |
| `VITE_PLAUSIBLE_DOMAIN` | Opcional — domínio Plausible (ex: `e4.gg`); vazio = sem analytics |

**Secrets Edge Functions (Dashboard → Edge Functions → Secrets)**

| Secret | Uso |
|---|---|
| `DISCORD_BOT_TOKEN` | Sync de cargos + tickets |
| `DISCORD_GUILD_ID` | Servidor Discord |
| `DISCORD_ADMIN_ROLE_ID` / `DISCORD_STAFF_ROLE_ID` | `profiles.role` + moderar tickets |
| `DISCORD_PUBLIC_KEY` | Verificar Interactions Endpoint |
| `DISCORD_CATEGORY_OPEN_ID` / `_IN_PROGRESS_ID` / `_FINISHED_ID` | Categorias dos tickets |
| `STRIPE_SECRET_KEY` | (opcional agora) Checkout Session |
| `STRIPE_WEBHOOK_SECRET` | Assinatura do webhook Stripe |
| `SITE_URL` | URLs de sucesso/cancelamento Stripe |
| `FIVEM_API_KEY` | Header `x-api-key` das functions FiveM |

### 5. Hero media (Lighthouse)

Guia: **[docs/hero-media.md](./docs/hero-media.md)** — gerar `e4-hero.webm` / `e4-hero.mp4` com ffmpeg. Sem webm, a home ainda usa o GIF (performance mobile pode ficar <90 até converter). Poster: `public/e4-hero-poster.jpg`.

Antes do lançamento, atualize o domínio em `public/sitemap.xml` e `public/robots.txt`.

## Scripts

```bash
pnpm dev
pnpm build
pnpm preview
```

## Docker

```bash
# Preencha VITE_* no .env (usados como build-args)
docker compose up --build
```

Detalhes de produção / EasyPanel: **[docs/deploy-easypanel.md](./docs/deploy-easypanel.md)**  
Checklist de go-live: **[docs/launch-checklist.md](./docs/launch-checklist.md)**  
Advisors / RLS: **[docs/security-advisors.md](./docs/security-advisors.md)**

## Fases

- **Fase 0** — Fundação (tokens, UI libs, rotas, hero)
- **Fase 1** — Auth Discord + sync de cargos + tag admin
- **Fase 2** — Home completa (stats, regras, prévia loja, depoimentos)
- **Fase 3** — Regras editáveis (`/regras` + `/admin/regras`)
- **Fase 4** — Loja Stripe (catálogo Supabase, Checkout, webhook, entrega FiveM)
- **Fase 5** — Painel admin (conteúdo, depoimentos, usuários)
- **Fase 6** — Polimento, SEO, analytics, mobile
- **Fase 7** — QA & lançamento (checklist + Docker/nginx) (atual)

### Checklist Lighthouse (Fase 6)

No Chrome DevTools → Lighthouse → Mobile, rode em `/`, `/regras`, `/loja`. Meta: ≥90 performance e acessibilidade. Se o hero ainda for GIF sem webm, performance da home pode ficar abaixo de 90 — ver `docs/hero-media.md`.
