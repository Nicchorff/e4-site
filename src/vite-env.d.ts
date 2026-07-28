/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_DISCORD_INVITE_URL?: string
  readonly VITE_INSTAGRAM_URL?: string
  readonly VITE_TIKTOK_URL?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_PLAUSIBLE_DOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
