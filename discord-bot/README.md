# E4 Whitelist Discord Bot

Gateway bot that posts the form embed, runs sequential Q&A in private threads, and **bootstraps a new Discord server** (roles, whitelist channels, ticket categories, `/comprovante-aprovado`).

See [docs/discord-whitelist.md](../docs/discord-whitelist.md).

## New guild (after server switch)

1. Invite the **existing** bot (Developer Portal → OAuth2 → URL Generator, scope `bot`, or the URL printed by the script).
2. Fill `discord-bot/.env` with `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` (or leave guild empty if the bot is in only one server), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Run:

```bash
cd discord-bot
npm install
npm run setup-guild
```

The script creates missing roles/channels, registers the slash command, prints env, and upserts `discord_runtime_config`. On EasyPanel, the same setup runs automatically when the bot starts. Admins can also type `!e4-setup` in Discord.

```bash
cp .env.example .env
npm start
```
