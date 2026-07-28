import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCategories } from '@/lib/store'
import type { StoreCategory } from '@/types/store'
import { ShimmerSkeleton } from '@/components/unlumen-ui/shimmer-skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function LojaPage() {
  useDocumentTitle('Loja · Elite Four')
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetchCategories().then((data) => {
      if (!cancelled) {
        setCategories(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-4 rounded-md border border-e4-gold/40 bg-e4-gold/10 px-4 py-2 text-center font-mono text-xs text-e4-gold sm:text-sm">
        Pagamento via ticket Discord (temporário) · produtos digitais E4
      </div>

      <header className="mb-8 max-w-2xl">
        <p className="font-pixel-badge text-e4-gold">LOJA</p>
        <h1 className="mt-2 font-display text-3xl text-e4-white sm:text-4xl">
          Fortaleça seu personagem
        </h1>
        <p className="mt-3 text-e4-silver">
          Escolha uma categoria. No carrinho, abra um ticket no Discord e envie
          o comprovante para a staff aprovar.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <ShimmerSkeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/loja/categoria/${cat.slug}`}
              className="rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-5 transition hover:border-e4-gold hover:shadow-[0_0_24px_rgba(242,183,5,0.15)]"
            >
              <h2 className="font-display text-2xl text-e4-gold">{cat.name}</h2>
              <p className="mt-2 text-sm text-e4-silver">{cat.description}</p>
              <span className="mt-4 inline-block font-display text-xs font-bold uppercase tracking-wide text-e4-white">
                Ver pacotes →
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
