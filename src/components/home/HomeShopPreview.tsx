import { Link } from 'react-router-dom'
import { TiltCard } from '@/components/unlumen-ui/tilt-card'
import { Button } from '@/components/ui/button'

const PREVIEWS = [
  {
    title: 'VIP Elite',
    description: 'Prioridade, benefícios diários e tag exclusiva no Discord.',
    badgeLabel: 'DESTAQUE',
    badgeVariant: 'warning' as const,
    href: '/loja',
  },
  {
    title: 'Veículos',
    description: 'Montarias e carros temáticos pra circular pela cidade.',
    badgeLabel: 'NOVO',
    badgeVariant: 'success' as const,
    href: '/loja',
  },
  {
    title: 'Cosméticos',
    description: 'Skins e itens visuais pro seu personagem brilhar no RP.',
    price: 'A partir de',
    badgeLabel: 'LOJA',
    badgeVariant: 'success' as const,
    href: '/loja',
  },
]

export function HomeShopPreview() {
  return (
    <section className="bg-e4-black-soft px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl text-e4-gold sm:text-3xl">
              Prévia da loja
            </h2>
            <p className="mt-2 max-w-xl text-sm text-e4-silver sm:text-base">
              Pacotes digitais pro servidor. Catálogo completo e checkout na
              próxima fase — por enquanto, explore as categorias.
            </p>
          </div>
          <Button
            asChild
            className="bg-e4-gold font-display font-bold uppercase tracking-wide text-e4-black hover:bg-e4-gold-deep hover:text-e4-white"
          >
            <Link to="/loja">Ver loja</Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEWS.map((item) => (
            <TiltCard
              key={item.title}
              title={item.title}
              description={item.description}
              badgeLabel={item.badgeLabel}
              badgeVariant={item.badgeVariant}
              href={item.href}
              className="border border-e4-gold-deep/40 bg-e4-black"
            />
          ))}
        </div>
      </div>
    </section>
  )
}
