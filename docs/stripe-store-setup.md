# Stripe + loja E4 — setup

Catálogo e pedidos ficam no **Supabase**. A **Stripe** só processa o pagamento (Checkout Session + webhook). Sem Tebex.

## Fluxo

1. Comprador autenticado (Discord) monta o carrinho e clica em pagar.
2. Edge Function `create-checkout-session` valida preços no DB, cria `orders`/`order_items` e uma Checkout Session.
3. Stripe redireciona para o Checkout hospedado.
4. Em `checkout.session.completed`, `stripe-webhook` marca o pedido `paid` e enfileira linhas em `deliveries` (`pending`).
5. O resource FiveM (`fivem-resource/elite4-delivery`) faz poll em `fivem-pending` e confirma com `fivem-deliver`.

## Variáveis

### Frontend (`.env`)

```env
VITE_SITE_URL=http://localhost:5173
VITE_SUPABASE_URL=https://dppyamtmjzmmkzjlmiew.supabase.co
VITE_SUPABASE_ANON_KEY=
# Opcional — Checkout redirect não exige publishable key no client
VITE_STRIPE_PUBLISHABLE_KEY=
```

### Secrets das Edge Functions (Dashboard → Edge Functions → Secrets)

| Secret | Uso |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` do endpoint webhook |
| `SITE_URL` | URL pública do site (success/cancel URLs) |
| `FIVEM_API_KEY` | Mesma chave do `config.lua` do resource |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no runtime.

## Stripe Dashboard

1. Crie conta / ative modo **Test**.
2. Developers → API keys → copie Secret Key para `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → Add endpoint:
   - URL: `https://dppyamtmjzmmkzjlmiew.supabase.co/functions/v1/stripe-webhook`
   - Evento: `checkout.session.completed`
   - Copie o signing secret → `STRIPE_WEBHOOK_SECRET`
4. (Local) use o CLI:

```bash
stripe listen --forward-to https://dppyamtmjzmmkzjlmiew.supabase.co/functions/v1/stripe-webhook
```

Use o `whsec_…` que o `listen` imprimir enquanto testar localmente.

## Functions deployadas

| Function | JWT |
|---|---|
| `create-checkout-session` | sim (usuário logado) |
| `stripe-webhook` | **não** (assinatura Stripe) |
| `fivem-pending` | **não** (`x-api-key`) |
| `fivem-deliver` | **não** (`x-api-key`) |

## Checklist de compra de teste

- [ ] Secrets Stripe + `SITE_URL` + `FIVEM_API_KEY` configurados
- [ ] Catálogo seed visível em `/loja`
- [ ] Login Discord → adicionar item → `/loja/carrinho` → Checkout
- [ ] Cartão de teste `4242 4242 4242 4242`
- [ ] Webhook marca `orders.status = paid` e cria `deliveries`
- [ ] Resource FiveM (ou `curl` com `x-api-key`) lista pending

Sem chaves Stripe, catálogo/carrinho/UI admin funcionam; o CTA de pagar falha até as secrets existirem — isso é esperado.

## FiveM

Ver `fivem-resource/elite4-delivery/README.md`. Matching do jogador é por **Discord ID** (`player_discord_id`), alinhado ao perfil Auth.

## Pix / Brasil

Habilite métodos de pagamento no Dashboard Stripe (conta BR). Pix não é obrigatório nesta fase.

## Admin

`/admin/loja` — listar/editar produtos, toggle destaque e badge em `featured_items`.
