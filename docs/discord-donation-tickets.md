# Tickets de doação via Discord (sem Stripe na UI)

Fluxo temporário da loja E4: o carrinho abre um **canal de texto** no guild, a staff assume e aprova o comprovante com `/comprovante-aprovado`. O site marca o pedido como pago e enfileira entregas (mesmo caminho do webhook Stripe).

Stripe Checkout permanece no repositório (`create-checkout-session`, `stripe-webhook`) mas **não** aparece na UI.

Projeto Supabase: `site` (`dppyamtmjzmmkzjlmiew`).

---

## Fluxo

1. Usuário logado no site → **Abrir ticket** no carrinho
2. Edge `create-donation-ticket` cria `orders` + `order_items` (`payment_method=discord_ticket`, `pending`) e um **canal de texto por doação** na categoria **Ticket | Aberto**
3. Staff clica **Assumir** → esse canal vai para **Ticket | Em andamento**
4. Staff roda `/comprovante-aprovado` no canal → pedido `paid` + `deliveries` + canal em **Ticket | Finalizado**

Interactions Endpoint (sem bot gateway 24/7): Discord POST → Edge `discord-interactions`.

---



## 1. Categorias no Discord

No servidor E4, crie **três categorias** (Discord não aninha categoria dentro de categoria — o prefixo `Ticket |` agrupa visualmente):


| Nome sugerido da categoria | Secret                            |
| -------------------------- | --------------------------------- |
| `Ticket | Aberto`          | `DISCORD_CATEGORY_OPEN_ID`        |
| `Ticket | Em andamento`    | `DISCORD_CATEGORY_IN_PROGRESS_ID` |
| `Ticket | Finalizado`      | `DISCORD_CATEGORY_FINISHED_ID`    |


Cada doação vira um **canal** (ex.: `doacao-fulano-a1b2c3d4`) que o bot **move** entre essas categorias.

### Visibilidade (importante)


| Quem                                                        | O que vê                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Cargos responsáveis (Admin/Staff + IDs em `/admin/doacoes`) | Sempre as **3 categorias** e **todos** os canais de ticket                     |
| Doador com ticket aberto/em andamento                       | Só o **próprio canal** (a categoria aparece só por causa desse canal)          |
| Membro sem ticket                                           | **Não vê** as categorias Ticket                                                |
| Bot E4                                                      | Sempre vê as categorias e pode enviar a mensagem inicial (overwrite explícito) |


Na prática o bot aplica:

1. Nas 3 categorias: `@everyone` **nega** Ver canal; cargos responsáveis **permitem** Ver canal
2. Em cada canal de doação: `@everyone` nega; doador permite; cargos responsáveis permitem
3. Ao finalizar (`/comprovante-aprovado`): remove o acesso do doador ao canal (categoria some para ele se não tiver outro ticket)

Modo desenvolvedor → clique direito na categoria → **Copiar ID**.

---



## 2. Permissões do bot

O bot precisa (no mínimo):

- Manage Channels  
- View Channels  
- Send Messages  
- Embed Links  
- Read Message History  
- Attach Files (útil para ver comprovantes)

Reconvide o bot se o invite antigo não incluir **Manage Channels**.

Também configure no portal:

1. **General Information** → copie **Public Key** → secret `DISCORD_PUBLIC_KEY`
2. **Interactions Endpoint URL** →
  `https://dppyamtmjzmmkzjlmiew.supabase.co/functions/v1/discord-interactions`
3. Discord envia PING; a function responde `type: 1` após verificar Ed25519.

---



## 3. Secrets (Supabase Edge)

Além dos já usados no sync de cargos:


| Secret                                            | Uso                                      |
| ------------------------------------------------- | ---------------------------------------- |
| `DISCORD_BOT_TOKEN`                               | REST (criar/mover canais, mensagens)     |
| `DISCORD_GUILD_ID`                                | Guild E4                                 |
| `DISCORD_PUBLIC_KEY`                              | Verificar interactions                   |
| `DISCORD_CATEGORY_OPEN_ID`                        | Categoria `Ticket | Aberto` (canal novo) |
| `DISCORD_CATEGORY_IN_PROGRESS_ID`                 | Categoria `Ticket | Em andamento`        |
| `DISCORD_CATEGORY_FINISHED_ID`                    | Categoria `Ticket | Finalizado`          |
| `DISCORD_ADMIN_ROLE_ID` / `DISCORD_STAFF_ROLE_ID` | Também podem Assumir / aprovar           |


CLI (exemplo):

```bash
npx supabase secrets set \
  DISCORD_PUBLIC_KEY=... \
  DISCORD_CATEGORY_OPEN_ID=... \
  DISCORD_CATEGORY_IN_PROGRESS_ID=... \
  DISCORD_CATEGORY_FINISHED_ID=... \
  --project-ref dppyamtmjzmmkzjlmiew
```

---



## 4. Deploy das functions

```bash
npx supabase functions deploy create-donation-ticket --project-ref dppyamtmjzmmkzjlmiew
npx supabase functions deploy discord-interactions --project-ref dppyamtmjzmmkzjlmiew --no-verify-jwt
```

`discord-interactions` **deve** ter JWT verification desligada (`verify_jwt = false` em `supabase/config.toml`), senão o Discord não valida o endpoint.

---



## 5. Registrar slash command

O comando de guild é registrado automaticamente no start do bot (`setup-guild` / `!e4-setup`). Manual:

```bash
curl -X POST "https://discord.com/api/v10/applications/<APP_ID>/guilds/<GUILD_ID>/commands" \
  -H "Authorization: Bot <BOT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"comprovante-aprovado\",\"description\":\"Marca o ticket deste canal como pago e enfileira a entrega\",\"type\":1}"
```

Comando de guild aparece quase na hora. Global pode levar até ~1h.

---



## 6. Cargos que veem tickets (site)

Em **Admin → Doações** (`/admin/doacoes`), cole os Discord **role IDs** (um por linha). Esses cargos recebem permissão de ver/enviar no canal do ticket.

Admin/Staff do sync (`DISCORD_ADMIN_ROLE_ID` / `DISCORD_STAFF_ROLE_ID`) também podem Assumir e aprovar mesmo se não estiverem na lista.

---



## 7. Checklist pós-deploy

- [ ] 3 categorias `Ticket | …` criadas + IDs nos secrets  
- [ ] `DISCORD_PUBLIC_KEY` setado  
- [ ] Interactions URL salva e “All your edits have been carefully secured” / endpoint validado  
- [ ] Functions deployadas  
- [ ] `/comprovante-aprovado` registrado no guild  
- [ ] Role IDs em `/admin/doacoes`  
- [ ] Teste: login → carrinho → Abrir ticket → Assumir → comando → pedido `paid` em `orders`  
- [ ] EasyPanel: rebuild do site só se mudou copy/UI (sem secrets Stripe novos)

---



## Troubleshooting


| Sintoma                     | Causa provável                                                   |
| --------------------------- | ---------------------------------------------------------------- |
| Endpoint Interactions falha | JWT on na function, public key errada, ou URL errada             |
| Canal não cria              | Bot sem Manage Channels / category ID errado / bot fora do guild |
| Doador não vê o canal       | `profiles.discord_id` ausente ou overwrite falhou                |
| Staff não vê                | Role IDs vazios em settings + sem admin/staff role no Discord    |
| Comando não aparece         | Não registrado / app errada / guild errado                       |
| Pedido não fica `paid`      | Rodar comando fora do canal do ticket; logs da function          |


Logs: Supabase Dashboard → Edge Functions → `create-donation-ticket` / `discord-interactions`.