import InfiniteSlider from '@/components/smoothui/infinite-slider'
import type { Testimonial } from '@/types/home'

type HomeTestimonialsProps = {
  items: Testimonial[]
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function HomeTestimonials({ items }: HomeTestimonialsProps) {
  if (items.length === 0) return null

  return (
    <section className="overflow-hidden bg-e4-black px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-2xl text-e4-gold sm:text-3xl">
          O que a comunidade diz
        </h2>
        <p className="mt-2 max-w-xl text-sm text-e4-silver sm:text-base">
          Depoimentos da galera. Curadoria completa chega no painel admin.
          estiver no ar.
        </p>
      </div>

      <div className="mt-10">
        <InfiniteSlider gap={20} speed={40} speedOnHover={20}>
          {items.map((item) => (
            <article
              key={item.id}
              className="w-[min(85vw,22rem)] shrink-0 rounded-lg border border-e4-gold-deep/35 bg-e4-black-soft p-5"
            >
              <p className="text-sm leading-relaxed text-e4-white">
                “{item.body}”
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-e4-gold">
                  {item.author_name}
                </p>
                <time
                  dateTime={item.displayed_at}
                  className="font-mono text-xs text-e4-silver"
                >
                  {formatDate(item.displayed_at)}
                </time>
              </div>
            </article>
          ))}
        </InfiniteSlider>
      </div>
    </section>
  )
}
