-- Store RLS (já aplicada remotamente na Fase 4).
-- Mantida no repo para histórico / fresh environments.

alter table public.store_categories enable row level security;
alter table public.store_products enable row level security;
alter table public.featured_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.deliveries enable row level security;

-- Idempotent: drop + recreate for local resets
drop policy if exists "Public read active categories" on public.store_categories;
drop policy if exists "Admin all categories" on public.store_categories;
create policy "Public read active categories"
  on public.store_categories for select to anon, authenticated
  using (is_active = true);
create policy "Admin all categories"
  on public.store_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read active products" on public.store_products;
drop policy if exists "Admin all products" on public.store_products;
create policy "Public read active products"
  on public.store_products for select to anon, authenticated
  using (is_active = true);
create policy "Admin all products"
  on public.store_products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read active featured" on public.featured_items;
drop policy if exists "Admin all featured" on public.featured_items;
create policy "Public read active featured"
  on public.featured_items for select to anon, authenticated
  using (is_active = true);
create policy "Admin all featured"
  on public.featured_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users read own orders" on public.orders;
drop policy if exists "Users insert own pending orders" on public.orders;
create policy "Users read own orders"
  on public.orders for select to authenticated
  using (auth.uid() = user_id);
create policy "Users insert own pending orders"
  on public.orders for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Users read own order items" on public.order_items;
drop policy if exists "Users insert own order items" on public.order_items;
create policy "Users read own order items"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );
create policy "Users insert own order items"
  on public.order_items for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
        and o.status = 'pending'
    )
  );

drop policy if exists "No direct client deliveries" on public.deliveries;
create policy "No direct client deliveries"
  on public.deliveries for select to authenticated
  using (false);
