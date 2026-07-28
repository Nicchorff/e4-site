export type StoreCategory = {
  id: string
  slug: string
  name: string
  description: string
  image_url: string | null
  display_order: number
  is_active: boolean
}

export type StoreProduct = {
  id: string
  category_id: string
  slug: string
  name: string
  description: string
  price_cents: number
  image_url: string | null
  benefits: string[]
  delivery_payload: Record<string, unknown>
  is_featured: boolean
  is_active: boolean
}

export type FeaturedItem = {
  id: string
  product_id: string
  custom_badge: string | null
  display_order: number
  is_active: boolean
  product?: StoreProduct
}

export type CartLine = {
  product: StoreProduct
  quantity: number
}

export function formatBrl(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}
