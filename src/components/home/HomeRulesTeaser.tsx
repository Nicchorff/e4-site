import { Link } from 'react-router-dom'

type HomeRulesTeaserProps = {
  items: string[]
}

export function HomeRulesTeaser({ items }: HomeRulesTeaserProps) {
  return (
    <section className="bg-e4-black px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl text-e4-gold sm:text-3xl">
              Regras em resumo
            </h2>
            <p className="mt-2 max-w-xl text-sm text-e4-silver sm:text-base">
              O básico pra jogar limpo. O regulamento completo está na página de
              regras.
            </p>
          </div>
          <Link
            to="/regras"
            className="font-display text-sm font-bold uppercase tracking-wide text-e4-gold hover:underline"
          >
            Ver regras completas
          </Link>
        </div>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex gap-3 rounded-lg border border-e4-gold-deep/30 bg-e4-black-soft p-4"
            >
              <span className="font-pixel-badge shrink-0 text-e4-dusk">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="text-sm leading-relaxed text-e4-white sm:text-base">
                {item}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
