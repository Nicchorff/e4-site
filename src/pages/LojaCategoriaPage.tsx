import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { GlowingBadge } from '@/components/unlumen-ui/glowing-badge'
import { ShimmerSkeleton } from '@/components/unlumen-ui/shimmer-skeleton'
import { useCart } from '@/hooks/useCart'
import {
  fetchCategoryBySlug,
  fetchProductsByCategoryId,
} from '@/lib/store'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatBrl, type StoreCategory, type StoreProduct } from '@/types/store'

export function LojaCategoriaPage() {
  const { slug = '' } = useParams()
  const { addItem } = useCart()
  const [category, setCategory] = useState<StoreCategory | null>(null)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  useDocumentTitle(
    category ? `${category.name} · Loja · Elite Four` : 'Categoria · Elite Four',
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      const cat = await fetchCategoryBySlug(slug)
      if (cancelled) return
      setCategory(cat)
      if (cat) {
        const prods = await fetchProductsByCategoryId(cat.id)
        if (!cancelled) setProducts(prods)
      } else {
        setProducts([])
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-14">
        <ShimmerSkeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ShimmerSkeleton className="h-40 w-full rounded-lg" />
          <ShimmerSkeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-2xl text-e4-white">
          Categoria não encontrada
        </h1>
        <Link to="/loja" className="mt-4 inline-block text-e4-gold hover:underline">
          Voltar à loja
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        to="/loja"
        className="font-display text-xs font-bold uppercase tracking-wide text-e4-silver hover:text-e4-gold"
      >
        ← Categorias
      </Link>
      <h1 className="mt-3 font-display text-3xl text-e4-gold sm:text-4xl">
        {category.name}
      </h1>
      <p className="mt-2 max-w-2xl text-e4-silver">{category.description}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <article
            key={product.id}
            className="flex flex-col rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-5 transition hover:border-e4-gold/60"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl text-e4-white">
                {product.name}
              </h2>
              {product.is_featured && (
                <GlowingBadge className="font-pixel-badge shrink-0 text-[0.55rem]">
                  DESTAQUE
                </GlowingBadge>
              )}
            </div>
            <p className="mt-2 flex-1 text-sm text-e4-silver">
              {product.description}
            </p>
            {product.benefits.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-e4-silver">
                {product.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="font-mono text-lg text-e4-gold">
                {formatBrl(product.price_cents)}
              </p>
              <Button
                className="bg-e4-gold font-display font-bold uppercase text-e4-black hover:bg-e4-gold-deep hover:text-white"
                onClick={() => addItem(product)}
              >
                Adicionar
              </Button>
            </div>
          </article>
        ))}
      </div>

      {products.length === 0 && (
        <p className="mt-8 text-e4-silver">Nenhum produto nesta categoria.</p>
      )}
    </section>
  )
}
