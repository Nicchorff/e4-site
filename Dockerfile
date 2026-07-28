# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Vite embeds these at build time — pass via EasyPanel / docker build --build-arg
ARG VITE_SITE_URL=http://localhost:8080
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ARG VITE_DISCORD_INVITE_URL=
ARG VITE_INSTAGRAM_URL=
ARG VITE_TIKTOK_URL=
ARG VITE_STRIPE_PUBLISHABLE_KEY=
ARG VITE_PLAUSIBLE_DOMAIN=

ENV VITE_SITE_URL=$VITE_SITE_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_DISCORD_INVITE_URL=$VITE_DISCORD_INVITE_URL \
    VITE_INSTAGRAM_URL=$VITE_INSTAGRAM_URL \
    VITE_TIKTOK_URL=$VITE_TIKTOK_URL \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_PLAUSIBLE_DOMAIN=$VITE_PLAUSIBLE_DOMAIN

RUN pnpm build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
