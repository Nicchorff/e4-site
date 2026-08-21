# Tickets Discord (doação + suporte)

Doação continua saindo do **carrinho** no site. Dúvida, suporte e reporte abrem no canal público **#tickets**. Os dois usam as mesmas categorias `Ticket | Aberto` / `Em andamento` / `Finalizado` e os mesmos cargos de `/admin/doacoes`.

Projeto Supabase: `site` (`dppyamtmjzmmkzjlmiew`).

---

## Fluxos

### Doação (loja)

1. Usuário logado → **Abrir ticket** no carrinho
2. Edge `create-donation-ticket` cria pedido + canal `doacao-…`
3. Staff clica **Assumir** → **Ticket | Em andamento**
4. Staff roda `/comprovante-aprovado` → pedido `paid` + entregas + **Ticket | Finalizado**

Detalhes de secrets/checkout: [discord-donation-tickets.md](./discord-donation-tickets.md).

### Dúvida / suporte / reporte

1. Bot publica embed em `#tickets` (3 botões)
2. Modal: assunto + descrição
3. Edge `discord-interactions` cria canal privado + row em `support_tickets` (`open`)
4. Staff **Assumir** ou **Encerrar** (botão) — ou `/encerrar` no canal
5. Fila no site: `/admin/tickets` (admins também podem encerrar suporte pelo site)

Um membro só pode ter **um** ticket de suporte `open` / `in_progress` por vez. Encerrar suporte **não** marca pedido como pago.

---

## Canal do painel

O embed com os 3 botões vai no canal **`1534356212773032006`** (`DISCORD_TICKET_PANEL_CHANNEL_ID`). O bot só posta/atualiza a mensagem; não cria outro `#tickets`. ID também fica em `discord_runtime_config.ticket_panel_channel_id`.

---

## Admin

| Página | Uso |
| --- | --- |
| `/admin/tickets` | Fila (tipo, status, quem abriu, quem assumiu, link do canal) |
| `/admin/doacoes` | Role IDs que veem **todos** os tickets |

Doação na fila é só leitura; para pagar use `/comprovante-aprovado` no Discord.

---

## Deploy

```bash
npx supabase db push --project-ref dppyamtmjzmmkzjlmiew
npx supabase functions deploy discord-interactions --project-ref dppyamtmjzmmkzjlmiew --no-verify-jwt
npx supabase functions deploy support-ticket-moderate --project-ref dppyamtmjzmmkzjlmiew
npx supabase functions deploy create-donation-ticket --project-ref dppyamtmjzmmkzjlmiew
```

Reinicie o bot Discord (EasyPanel) para criar `#tickets`, o embed e registrar `/encerrar`.
