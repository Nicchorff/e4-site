FROM node:22-alpine
WORKDIR /app

# EasyPanel build context = repo root (see -f discord-bot/Dockerfile)
COPY discord-bot/package.json discord-bot/package-lock.json ./
RUN npm ci --omit=dev

COPY discord-bot/src ./src

# EasyPanel often injects secrets as build-args; keep runtime ENV preferred
ARG DISCORD_BOT_TOKEN
ARG DISCORD_GUILD_ID
ARG SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG DISCORD_WL_FORM_CHANNEL_ID
ARG DISCORD_WL_THREAD_CHANNEL_ID

ENV DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN \
    DISCORD_GUILD_ID=$DISCORD_GUILD_ID \
    SUPABASE_URL=$SUPABASE_URL \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    DISCORD_WL_FORM_CHANNEL_ID=$DISCORD_WL_FORM_CHANNEL_ID \
    DISCORD_WL_THREAD_CHANNEL_ID=$DISCORD_WL_THREAD_CHANNEL_ID \
    NODE_ENV=production

CMD ["node", "src/index.js"]
