# Whitelist Discord (formulário + entrevista)

Fluxo no servidor E4: embed no canal de formulário → modal com código do jogo (6 dígitos) → thread privada no canal de whitelist → perguntas uma a uma → revisão no admin do site → cargo de entrevista → revisão de entrevista → cargo final + `POST /vrp/whitelist`.

Projeto Supabase: `site` (`dppyamtmjzmmkzjlmiew`).

---

## Canais e cargos (IDs)

| Uso | ID |
| --- | --- |
| Canal embed / botão | `1509568568948293773` |
| Canal threads (formulário) | `1509568521129033973` |
| Resultado formulário | `1533252788908462231` |
| Resultado entrevista | `1527449034715828225` |
| Cargo entrevista | `1509730162546184312` |
| Cargo aprovado | `1527875867358007448` |

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

Além dos secrets Discord já usados (doações):

```
DISCORD_WL_FORM_CHANNEL_ID=1509568568948293773
DISCORD_WL_THREAD_CHANNEL_ID=1509568521129033973
DISCORD_WL_RESULT_FORM_CHANNEL_ID=1533252788908462231
DISCORD_WL_RESULT_INTERVIEW_CHANNEL_ID=1527449034715828225
DISCORD_WL_INTERVIEW_ROLE_ID=1509730162546184312
DISCORD_WL_APPROVED_ROLE_ID=1527875867358007448
FIVEM_WHITELIST_URL=http://104.234.63.28:30120/vrp/whitelist
FIVEM_WHITELIST_TOKEN=1111.892334344.53564453125
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
DISCORD_BOT_TOKEN=          # Discord Developer Portal → Bot → Reset/Copy Token
DISCORD_GUILD_ID=           # Clique direito no servidor → Copiar ID
SUPABASE_URL=https://dppyamtmjzmmkzjlmiew.supabase.co
SUPABASE_SERVICE_ROLE_KEY=  # Supabase → Project Settings → API → service_role
DISCORD_WL_FORM_CHANNEL_ID=1509568568948293773
DISCORD_WL_THREAD_CHANNEL_ID=1509568521129033973
```

### EasyPanel (app separado do site)

O site estático **não** roda o Gateway. Crie **outro app** só para o bot:

1. No mesmo projeto EasyPanel → **+ Create** → **App**
2. Source: mesmo repo GitHub (`Nicchorff/e4-site`), branch `main`
3. Build:
   - **Dockerfile path:** `discord-bot/Dockerfile`
   - **Docker context / Build context:** `discord-bot`
4. **Ports:** não precisa expor porta (é worker Gateway, não HTTP)
5. **Environment** (Runtime, não Build Args) — cole as variáveis do bloco acima (token, guild, service role + IDs dos canais)
6. Deploy / Restart
7. Nos logs deve aparecer algo como: `Whitelist bot ready as ...` e `Posted/Updated whitelist form embed`

Se o painel exigir Build Context na raiz do repo, use:

- Dockerfile path: `discord-bot/Dockerfile`
- Context: `.` (raiz) **e** ajuste o Dockerfile para `COPY discord-bot/...` — o default deste repo já assume context = pasta `discord-bot`.

Reinicie o app sempre que mudar env.

### Rodar local

```bash
cd discord-bot
npm install
npm start
```

No start, o bot posta ou edita o embed no canal do formulário. Depois de editar o embed no admin (`/admin/whitelist/perguntas`), um admin pode digitar `!wl-refresh-embed` nesse canal para republicar.

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

Escritas de application/answers: service role (Edge + bot). Admin lê via RLS `is_admin()`.

---

## Notas

- Código do jogo: exatamente 6 dígitos
- Um discord_id não pode ter outro formulário enquanto status for `in_progress`, `pending_review`, `interview` ou `approved`
- `rejected_form` / `rejected_interview` permitem refazer
- Liberação vRP só na **aprovação da entrevista**
