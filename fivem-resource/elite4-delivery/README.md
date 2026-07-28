# E4 — FiveM delivery resource (stub)

Consulta as Edge Functions Supabase e entrega itens após pagamento Stripe.

## Instalação

1. Copie `elite4-delivery` para `resources/[local]/elite4-delivery`.
2. Edite `config.lua`:
   - `Config.ApiBaseUrl` — `https://<project-ref>.supabase.co/functions/v1`
   - `Config.ApiKey` — igual a `FIVEM_API_KEY` nos secrets das functions
3. No `server.cfg`:

```cfg
ensure elite4-delivery
```

## Endpoints

| Método | Path | Ação |
|---|---|---|
| GET | `/fivem-pending` | Lista `deliveries` com status `pending` |
| POST | `/fivem-deliver` | Body `{ deliveryId, status, errorMessage? }` |

Header obrigatório: `x-api-key: <FIVEM_API_KEY>`.

## Matching do jogador

O webhook grava `player_discord_id` a partir do perfil Auth. O resource procura o identifier `discord:<id>` online.

## Integração

Implemente `ApplyDelivery` em `server/main.lua` para o framework do servidor (ESX / QBCore / vRP). O stub só loga o payload e retorna `true` para tipos conhecidos.

## Teste rápido sem FiveM

```bash
curl -H "x-api-key: $FIVEM_API_KEY" \
  "https://dppyamtmjzmmkzjlmiew.supabase.co/functions/v1/fivem-pending"
```
