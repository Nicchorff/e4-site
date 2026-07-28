# Stripe + loja E4 — setup

Catálogo e pedidos ficam no **Supabase**. A **Stripe** só processa o pagamento (Checkout Session + webhook). Sem Tebex / Billing / Invoicing nesta etapa.

**Produção atual:** `https://sites-e4.ltgujx.easypanel.host`

## Fluxo

1. Comprador autenticado (Discord) monta o carrinho e clica em pagar.
2. Edge Function `create-checkout-session` valida preços no DB, cria `orders`/`order_items` e uma Checkout Session (`locale: pt-BR`, payment methods automáticos).
3. Stripe redireciona para o Checkout hospedado.
4. Em `checkout.session.completed` (pago) ou `checkout.session.async_payment_succeeded` (ex.: Pix), `stripe-webhook` marca o pedido `paid` e enfileira `deliveries`.
5. O resource FiveM (`fivem-resource/elite4-delivery`) faz poll em `fivem-pending` e confirma com `fivem-deliver`.

## Variáveis

### EasyPanel — Build args (front)

```env
VITE_SITE_URL=https://sites-e4.ltgujx.easypanel.host
VITE_SUPABASE_URL=https://dppyamtmjzmmkzjlmiew.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_DISCORD_INVITE_URL=https://discord.gg/...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Rebuild da imagem após mudar qualquer `VITE_*`.

### Secrets Edge Functions (já configuráveis via CLI / Dashboard)

| Secret | Uso |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` do endpoint webhook |
| `SITE_URL` | `https://sites-e4.ltgujx.easypanel.host` |
| `FIVEM_API_KEY` | Header `x-api-key` das functions FiveM |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no runtime.

## Webhook Stripe (modo Test)

- URL: `https://dppyamtmjzmmkzjlmiew.supabase.co/functions/v1/stripe-webhook`
- Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- Signing secret → `STRIPE_WEBHOOK_SECRET`

Local (opcional):

```bash
stripe listen --forward-to https://dppyamtmjzmmkzjlmiew.supabase.co/functions/v1/stripe-webhook
```

## Functions

| Function | JWT |
|---|---|
| `create-checkout-session` | sim (usuário logado) |
| `stripe-webhook` | **não** (assinatura Stripe) |
| `fivem-pending` / `fivem-deliver` | **não** (`x-api-key`) |

## Checklist de compra de teste

- [x] Secrets Stripe + `SITE_URL` configurados no projeto Supabase
- [x] Webhook de teste criado apontando para `stripe-webhook`
- [ ] EasyPanel rebuild com `VITE_STRIPE_PUBLISHABLE_KEY` + `VITE_SITE_URL`
- [ ] Login Discord no domínio → item no carrinho → Pagar
- [ ] Cartão teste `4242 4242 4242 4242`
- [ ] Pedido `paid` + linha em `deliveries`
- [ ] **Rotacionar** a `sk_test` no Dashboard (foi exposta em chat) e atualizar o secret

## Pix / Brasil

Habilite Pix (e outros métodos) em Stripe Dashboard → Settings → Payment methods. O Checkout usa `automatic_payment_methods`.

## Segurança

- Nunca commit keys no Git.
- Secret key colada em chat: faça **Roll** em Developers → API keys após o primeiro teste OK e rode `supabase secrets set STRIPE_SECRET_KEY=sk_test_nova… --project-ref dppyamtmjzmmkzjlmiew`.

## Admin

`/admin/loja` — catálogo e destaques.
