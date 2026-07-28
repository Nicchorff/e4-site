# Deploy EasyPanel — E4 Site

App estático (Vite) servido por **nginx** na porta **80**. Secrets de Stripe/Discord ficam só no Supabase (Edge Functions), não no container.

## Build args (obrigatórios em produção)

O Vite embute `VITE_*` no bundle. No EasyPanel (ou `docker build`), passe:

| Build arg | Exemplo |
|---|---|
| `VITE_SITE_URL` | `https://SEU_DOMINIO` |
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

1. App type **Dockerfile** (raiz do repo).
2. Expose porta **80**; HTTPS no proxy do painel.
3. Configure os **build arguments** da tabela acima (rebuild após mudar qualquer `VITE_*`).
4. Healthcheck já existe no Dockerfile (`wget` em `/`).

## DNS

1. Aponte `A` ou `CNAME` de `SEU_DOMINIO` para a VPS / EasyPanel.
2. Aguarde TLS (Let's Encrypt no painel).

## Redirects / webhooks (substitua SEU_DOMINIO)

| Onde | Valor |
|---|---|
| Supabase Auth redirect allow list | `https://SEU_DOMINIO/auth/discord/callback` |
| Discord OAuth (callback do Supabase) | `https://dppyamtmjzmmkzjlmiew.supabase.co/auth/v1/callback` |
| Edge `SITE_URL` | `https://SEU_DOMINIO` |
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
