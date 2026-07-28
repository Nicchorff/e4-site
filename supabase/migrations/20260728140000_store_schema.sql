-- Store schema (Stripe) — Fase 4
-- Applied remotely via MCP; kept in repo for reference.

create table public.store_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  image_url text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.store_categories(id) on delete restrict,
  slug text unique not null,
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents > 0),
  image_url text,
  benefits jsonb not null default '[]'::jsonb,
  delivery_payload jsonb not null default '{}'::jsonb,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.featured_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  custom_badge text,
  display_order int not null default 0,
  is_active boolean not null default true
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null check (status in ('pending','paid','cancelled','refunded')),
  total_cents integer not null check (total_cents > 0),
  stripe_session_id text unique,
  stripe_payment_intent text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents > 0),
  delivery_payload jsonb not null default '{}'::jsonb
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  player_discord_id text not null,
  status text not null check (status in ('pending','processing','delivered','failed')),
  attempts integer not null default 0,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
