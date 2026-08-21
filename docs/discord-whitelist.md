# Whitelist Discord (formulário + entrevista)

Fluxo no servidor E4: embed no canal de formulário → modal com código do jogo (6 dígitos) → thread privada no canal de whitelist → perguntas uma a uma → revisão no admin do site → cargo de entrevista → revisão de entrevista → cargo final + `POST /vrp/whitelist`.

Projeto Supabase: `site` (`dppyamtmjzmmkzjlmiew`).

---

## Canais e cargos (IDs)

Não hardcode IDs do servidor antigo. No guild **novo**, o bot cria (ou reusa pelo nome):

| Nome | Uso |
| --- | --- |
| `Admin` / `Staff` | Sync de cargos no site + tickets |
| `Entrevista` / `Aprovado` | Whitelist |
| `#whitelist-formulario` | Embed + botão |
| `#whitelist-threads` | Threads privadas do formulário |
| `#resultado-formulario` / `#resultado-entrevista` | Resultados |
| Categorias `Ticket \| Aberto` / `Em andamento` / `Finalizado` | Loja |

IDs vão para `public.discord_runtime_config` (o bot grava no start / `npm run setup-guild` / `!e4-setup`). Secrets `DISCORD_*` no Supabase **sobrescrevem** a tabela se estiverem preenchidos.

Convide o bot existente (não crie outra Application). No start, os logs imprimem o bloco de env e o invite `discord.gg`.

---

## Fluxo

1. Bot Gateway (`discord-bot/`) publica / atualiza o embed com botão **Fazer formulário**
2. Clique → Interactions Endpoint (`discord-interactions`) abre modal do código
3. Submit → cria thread privada + row `whitelist_applications` (`in_progress`) + 1ª pergunta
4. Bot escuta respostas na thread, grava `whitelist_answers`, apaga msgs, próxima pergunta
5. Fim → `pending_review` (aparece em `/admin/whitelist/formularios`)
6. Admin aprova → cargo entrevista + msg no canal resultado formulário → status `interview`
7. Admin recusa form → pode refazer; msg no canal resultado formulário
8. `/admin/whitelist/entrevistas` → aprovar chama vRP + cargo aprovado + msg resultado entrevista; recusar exige motivo

---

## Secrets (Supabase Edge Functions)

Além dos secrets Discord já usados (doações). Se o bot já gravou `discord_runtime_config`, estes IDs são opcionais:

```
DISCORD_WL_FORM_CHANNEL_ID=
DISCORD_WL_THREAD_CHANNEL_ID=
DISCORD_WL_RESULT_FORM_CHANNEL_ID=
DISCORD_WL_RESULT_INTERVIEW_CHANNEL_ID=
DISCORD_WL_INTERVIEW_ROLE_ID=
DISCORD_WL_APPROVED_ROLE_ID=
FIVEM_WHITELIST_URL=http://104.234.63.28:30120/vrp/whitelist
FIVEM_WHITELIST_TOKEN=
```

Deploy das functions:

```bash
supabase functions deploy discord-interactions --project-ref dppyamtmjzmmkzjlmiew
supabase functions deploy whitelist-moderate --project-ref dppyamtmjzmmkzjlmiew
```

`whitelist-moderate` usa JWT (`verify_jwt = true`). `discord-interactions` permanece sem JWT (assinatura Ed25519).

---

## Bot Gateway (`discord-bot/`)

Precisa de **Gateway** (Message Content Intent) para ler respostas nas threads. O Interactions Endpoint HTTP **não** recebe `MESSAGE_CREATE`.

### Discord Developer Portal

1. Bot → Privileged Gateway Intents → **Message Content Intent** ON
2. Permissões no servidor: View Channels, Send Messages, Embed Links, Manage Messages, Manage Threads, Manage Roles, Read Message History

### Env do serviço

Copie `discord-bot/.env.example` → `.env` (ou use Environment Variables no EasyPanel):

```
DISCORD_BOT_TOKEN=          # Discord Developer Portal → Bot → Copy Token
DISCORD_GUILD_ID=           # Clique direito no servidor NOVO → Copiar ID
SUPABASE_URL=https://dppyamtmjzmmkzjlmiew.supabase.co
SUPABASE_SERVICE_ROLE_KEY=  # Supabase → Project Settings → API → service_role
# Canais opcionais — o bot cria no start se vazios
DISCORD_WL_FORM_CHANNEL_ID=
DISCORD_WL_THREAD_CHANNEL_ID=
```

### EasyPanel

Mesmo repo, app separado **ou** Compose — ver [deploy-easypanel.md](./deploy-easypanel.md). Env mínimo do bot: token, `DISCORD_GUILD_ID`, `SUPABASE_URL`, service role. No start o bot cria a estrutura do guild e grava IDs.

Logs: `Whitelist bot ready`, bloco `copy to EasyPanel / Supabase secrets`, `Posted/Updated whitelist form embed`.

### Rodar local

```bash
cd discord-bot
npm install
npm run setup-guild   # cria cargos/canais + slash (bot já no guild)
npm start
```

No start, o bot posta ou edita o embed no canal do formulário. Admin: `!wl-refresh-embed` no canal do form, ou `!e4-setup` para recriar/atualizar a estrutura.

---

## Admin no site

| Rota | Função |
| --- | --- |
| `/admin/whitelist/perguntas` | CRUD perguntas + texto/imagem do embed |
| `/admin/whitelist/formularios` | Lista `pending_review`, ver Q&A, aprovar/recusar |
| `/admin/whitelist/entrevistas` | Lista `interview`, aprovar (vRP) / recusar com motivo |

---

## Tabelas

- `whitelist_questions`
- `whitelist_embed_settings` (singleton id=1)
- `whitelist_applications`
- `whitelist_answers`
- `discord_runtime_config` (IDs do guild atual; o bot preenche)

Escritas de application/answers: service role (Edge + bot). Admin lê via RLS `is_admin()`.

---

## Notas

- Código do jogo: exatamente 6 dígitos
- Um discord_id não pode ter outro formulário enquanto status for `in_progress`, `pending_review`, `interview` ou `approved`
- `rejected_form` / `rejected_interview` permitem refazer
- Liberação vRP só na **aprovação da entrevista**
