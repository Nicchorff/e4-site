import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { FeaturedItem, StoreCategory, StoreProduct } from '@/types/store'

const FALLBACK_CATEGORIES: StoreCategory[] = [
  {
    id: 'fb-vip',
    slug: 'vip',
    name: 'VIP',
    description: 'Ranks e benefícios premium',
    image_url: null,
    display_order: 1,
    is_active: true,
  },
  {
    id: 'fb-veh',
    slug: 'veiculos',
    name: 'Veículos',
    description: 'Montarias e carros temáticos',
    image_url: null,
    display_order: 2,
    is_active: true,
  },
]

const FALLBACK_PRODUCTS: StoreProduct[] = [
  {
    id: 'fb-bronze',
    category_id: 'fb-vip',
    slug: 'vip-bronze',
    name: 'VIP Bronze',
    description: 'Entrada premium com benefícios essenciais.',
    price_cents: 2990,
    image_url: null,
    benefits: ['Tag VIP', 'Prioridade na fila'],
    delivery_payload: { type: 'vip', tier: 'bronze' },
    is_featured: true,
    is_active: true,
  },
  {
    id: 'fb-gold',
    category_id: 'fb-vip',
    slug: 'vip-gold',
    name: 'VIP Gold',
    description: 'Pacote popular com vantagens extras.',
    price_cents: 5990,
    image_url: null,
    benefits: ['Garagem extra', 'Kit premium'],
    delivery_payload: { type: 'vip', tier: 'gold' },
    is_featured: true,
    is_active: true,
  },
]

function mapProduct(row: Record<string, unknown>): StoreProduct {
  const benefits = row.benefits
  return {
    id: String(row.id),
    category_id: String(row.category_id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description ?? ''),
    price_cents: Number(row.price_cents),
    image_url: (row.image_url as string | null) ?? null,
    benefits: Array.isArray(benefits)
      ? benefits.map(String)
      : [],
    delivery_payload:
      (row.delivery_payload as Record<string, unknown>) ?? {},
    is_featured: Boolean(row.is_featured),
    is_active: Boolean(row.is_active),
  }
}

export async function fetchCategories(): Promise<StoreCategory[]> {
  if (!isSupabaseConfigured) return FALLBACK_CATEGORIES
  const { data, error } = await supabase
    .from('store_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) {
    console.error(error)
    return FALLBACK_CATEGORIES
  }
  return (data as StoreCategory[]) ?? FALLBACK_CATEGORIES
}

export async function fetchCategoryBySlug(
  slug: string,
): Promise<StoreCategory | null> {
  const cats = await fetchCategories()
  return cats.find((c) => c.slug === slug) ?? null
}

export async function fetchProductsByCategoryId(
  categoryId: string,
): Promise<StoreProduct[]> {
  if (!isSupabaseConfigured) {
    return FALLBACK_PRODUCTS.filter((p) => p.category_id === categoryId)
  }
  const { data, error } = await supabase
    .from('store_products')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('price_cents', { ascending: true })
  if (error) {
    console.error(error)
    return FALLBACK_PRODUCTS.filter((p) => p.category_id === categoryId)
  }
  return (data ?? []).map((r) => mapProduct(r as Record<string, unknown>))
}

export async function fetchProductsByIds(
  ids: string[],
): Promise<StoreProduct[]> {
  if (ids.length === 0) return []
  if (!isSupabaseConfigured) {
    return FALLBACK_PRODUCTS.filter((p) => ids.includes(p.id))
  }
  const { data, error } = await supabase
    .from('store_products')
    .select('*')
    .in('id', ids)
    .eq('is_active', true)
  if (error) {
    console.error(error)
    return []
  }
  return (data ?? []).map((r) => mapProduct(r as Record<string, unknown>))
}

export async function fetchAllProductsAdmin(): Promise<StoreProduct[]> {
  if (!isSupabaseConfigured) return FALLBACK_PRODUCTS
  const { data, error } = await supabase
    .from('store_products')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => mapProduct(r as Record<string, unknown>))
}

export async function fetchFeaturedItems(): Promise<FeaturedItem[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('featured_items')
    .select('*, product:store_products(*)')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) {
    console.error(error)
    return []
  }
  return (data as FeaturedItem[]) ?? []
}

export async function setProductFeatured(
  productId: string,
  featured: boolean,
  badge?: string,
) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

  const { error: prodErr } = await supabase
    .from('store_products')
    .update({ is_featured: featured })
    .eq('id', productId)
  if (prodErr) throw prodErr

  if (featured) {
    const { data: existing } = await supabase
      .from('featured_items')
      .select('id')
      .eq('product_id', productId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('featured_items')
        .update({ is_active: true, custom_badge: badge ?? 'DESTAQUE' })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('featured_items').insert({
        product_id: productId,
        custom_badge: badge ?? 'DESTAQUE',
        display_order: 0,
        is_active: true,
      })
      if (error) throw error
    }
  } else {
    await supabase
      .from('featured_items')
      .update({ is_active: false })
      .eq('product_id', productId)
  }
}

export async function updateFeaturedBadge(productId: string, badge: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  const { error } = await supabase
    .from('featured_items')
    .update({ custom_badge: badge || null })
    .eq('product_id', productId)
  if (error) throw error
}

export type ProductWriteInput = {
  id?: string
  category_id: string
  slug: string
  name: string
  description: string
  price_cents: number
  image_url?: string | null
  benefits?: string[]
  delivery_payload?: Record<string, unknown>
  is_featured?: boolean
  is_active?: boolean
}

export async function upsertProduct(input: ProductWriteInput): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  const row = {
    category_id: input.category_id,
    slug: input.slug.trim(),
    name: input.name.trim(),
    description: input.description.trim(),
    price_cents: Math.round(input.price_cents),
    image_url: input.image_url || null,
    benefits: input.benefits ?? [],
    delivery_payload: input.delivery_payload ?? {},
    is_featured: input.is_featured ?? false,
    is_active: input.is_active ?? true,
  }
  if (input.id) {
    const { error } = await supabase
      .from('store_products')
      .update(row)
      .eq('id', input.id)
    if (error) throw error
    return input.id
  }
  const { data, error } = await supabase
    .from('store_products')
    .insert(row)
    .select('id')
    .single()
  if (error) throw error
  return String(data.id)
}

export async function fetchCategoriesAdmin(): Promise<StoreCategory[]> {
  if (!isSupabaseConfigured) return FALLBACK_CATEGORIES
  const { data, error } = await supabase
    .from('store_categories')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data as StoreCategory[]) ?? []
}

export async function createCheckoutSession(
  items: { productId: string; quantity: number }[],
): Promise<{ url: string; orderId: string }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado')
  }

  const { data, error } = await supabase.functions.invoke<{
    url?: string
    orderId?: string
    error?: string
  }>('create-checkout-session', {
    body: { items },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)
  if (!data?.url || !data.orderId) {
    throw new Error('Resposta inválida do checkout')
  }
  return { url: data.url, orderId: data.orderId }
}

export async function createDonationTicket(
  items: { productId: string; quantity: number }[],
): Promise<{ channelUrl: string; orderId: string }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado')
  }

  const { data, error } = await supabase.functions.invoke<{
    channelUrl?: string
    orderId?: string
    error?: string
  }>('create-donation-ticket', {
    body: { items },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)
  if (!data?.channelUrl || !data.orderId) {
    throw new Error('Resposta inválida ao abrir ticket')
  }
  return { channelUrl: data.channelUrl, orderId: data.orderId }
}

export async function fetchDonationTicketSettings(): Promise<{
  viewer_role_ids: string[]
}> {
  if (!isSupabaseConfigured) return { viewer_role_ids: [] }
  const { data, error } = await supabase
    .from('donation_ticket_settings')
    .select('viewer_role_ids')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return {
    viewer_role_ids: Array.isArray(data?.viewer_role_ids)
      ? data.viewer_role_ids.map(String)
      : [],
  }
}

export async function updateDonationTicketSettings(
  viewerRoleIds: string[],
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  const cleaned = viewerRoleIds.map((id) => id.trim()).filter(Boolean)
  const { error } = await supabase.from('donation_ticket_settings').upsert({
    id: 1,
    viewer_role_ids: cleaned,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
