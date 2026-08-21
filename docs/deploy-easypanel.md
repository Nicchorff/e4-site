# Deploy EasyPanel — E4 Site

App estático (Vite) servido por **nginx** na porta **80**. Secrets de Stripe/Discord ficam só no Supabase (Edge Functions), não no container.

## Build args (obrigatórios em produção)

O Vite embute `VITE_*` no bundle. No EasyPanel (ou `docker build`), passe:

| Build arg | Exemplo |
|---|---|
| `VITE_SITE_URL` | `https://sites-e4-site.ond9ub.easypanel.host` |
| `VITE_SUPABASE_URL` | `https://dppyamtmjzmmkzjlmiew.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key pública |
| `VITE_DISCORD_INVITE_URL` | invite do servidor |
| `VITE_STRIPE_PUBLISHABLE_KEY` | opcional |
| `VITE_PLAUSIBLE_DOMAIN` | opcional (ex: `seu.dominio`) |
| `VITE_INSTAGRAM_URL` / `VITE_TIKTOK_URL` | opcional |

### Local com Compose

```bash
# Copie .env.example → .env e preencha
docker compose up --build
# App em http://localhost:8080
```

Requer Docker Desktop (ou engine) instalado na máquina. Sem Docker, use `pnpm build && pnpm preview` localmente; o build de produção no EasyPanel usa o Dockerfile na VPS.

### CLI Docker

```bash
docker build \
  --build-arg VITE_SITE_URL=https://SEU_DOMINIO \
  --build-arg VITE_SUPABASE_URL=https://dppyamtmjzmmkzjlmiew.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=eyJ... \
  --build-arg VITE_DISCORD_INVITE_URL=https://discord.gg/... \
  -t e4-site .
docker run --rm -p 8080:80 e4-site
```

## EasyPanel

Repo GitHub: `Nicchorff/e4-site`, branch `main`. Projeto sugerido: `sites`.

**Produção atual:** `https://sites-e4-site.ond9ub.easypanel.host`

### App do bot (segundo serviço)

No mesmo projeto `sites`: **+ Serviço** → App.

| Campo EasyPanel | Valor |
|---|---|
| Método | Dockerfile |
| Arquivo | `discord-bot/Dockerfile` |
| Context | `.` (raiz) |
| Porta / domínio | nenhum |

**Environment** (e Build Args, se existir as duas abas — cole nos dois):

```
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
SUPABASE_URL=https://dppyamtmjzmmkzjlmiew.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

`DISCORD_GUILD_ID`: clique direito no ícone do servidor **novo** → Copiar ID (precisa **Modo desenvolvedor**). Token: Developer Portal → Bot → Copy (sem Reset). Service role: Supabase → Project Settings → API.

Não preencha canal IDs. Deploy → logs: `Whitelist bot ready` + bloco de IDs.

### Opção A — Compose (um app, dois serviços)

1. Create → App → **Docker Compose**
2. Compose file: `docker-compose.easypanel.yml` (context = raiz)
3. Environment / build args:

```
VITE_SITE_URL=https://sites-e4-site.ond9ub.easypanel.host
VITE_SUPABASE_URL=https://dppyamtmjzmmkzjlmiew.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcHlhbXRtanptbWt6amxtaWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzYxMTQsImV4cCI6MjEwMDc1MjExNH0.KirZOIr4WNisd8eqPMvv0lwp7fvRGZZvOzrvjPsgAvg
VITE_DISCORD_INVITE_URL=https://discord.gg/SEU_INVITE
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
SUPABASE_URL=https://dppyamtmjzmmkzjlmiew.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

4. Domínio no serviço `web` (porta 80). O `discord-bot` não expõe porta.

### Opção B — dois apps Dockerfile

**Site**

1. App type **Dockerfile** (raiz do repo).
2. Expose porta **80**; HTTPS no proxy do painel.
3. **Build arguments** da tabela acima (rebuild após mudar qualquer `VITE_*`).
4. Healthcheck já existe no Dockerfile (`wget` em `/`).

**Bot** (app separado)

1. Dockerfile path: `discord-bot/Dockerfile`
2. Build context: `.`
3. Sem porta
4. Environment: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

No primeiro start o bot cria cargos/canais no guild, registra `/comprovante-aprovado` e grava IDs em `discord_runtime_config`. Logs devem ter `Whitelist bot ready` e o bloco `copy to EasyPanel / Supabase secrets`.

## DNS

1. Aponte `A` ou `CNAME` de `SEU_DOMINIO` para a VPS / EasyPanel.
2. Aguarde TLS (Let's Encrypt no painel).

## Redirects / webhooks (substitua SEU_DOMINIO)

| Onde | Valor |
|---|---|
| Supabase Auth redirect allow list | `https://sites-e4-site.ond9ub.easypanel.host/auth/discord/callback` |
| Discord OAuth (callback do Supabase) | `https://dppyamtmjzmmkzjlmiew.supabase.co/auth/v1/callback` |
| Edge `SITE_URL` | `https://sites-e4-site.ond9ub.easypanel.host` |
| Stripe webhook | `https://dppyamtmjzmmkzjlmiew.supabase.co/functions/v1/stripe-webhook` |
| `robots.txt` / `sitemap.xml` | atualizar host para `https://SEU_DOMINIO` |

## Smoke pós-deploy

1. Home carrega (hero + seções)
2. Login Discord → perfil / badge admin
3. `/loja` lista categorias; carrinho → checkout (com Stripe test/live)
4. `/admin` acessível só para admin
5. Sem erros de “Supabase não configurado” no console

## Notas

- Rebuild da imagem é necessário sempre que mudar `VITE_*`.
- Não coloque `STRIPE_SECRET_KEY` / service role no EasyPanel do front — só nos secrets das Edge Functions.
