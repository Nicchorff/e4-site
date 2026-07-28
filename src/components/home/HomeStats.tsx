import { CountUp } from '@/components/unlumen-ui/count-up'
import type { SiteStat } from '@/types/home'

type HomeStatsProps = {
  stats: SiteStat[]
}

export function HomeStats({ stats }: HomeStatsProps) {
  return (
    <section className="bg-e4-black-soft px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-2xl text-e4-gold sm:text-3xl">
          A Elite Four em números
        </h2>
        <p className="mt-2 max-w-xl text-sm text-e4-silver sm:text-base">
          Comunidade ativa, cidade viva e loja pronta pra fortalecer seu
          personagem.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.id}
              className="rounded-lg border border-e4-gold-deep/35 bg-e4-black px-5 py-6 transition hover:border-e4-gold/60 hover:shadow-[0_0_24px_rgba(242,183,5,0.12)]"
            >
              <div className="flex items-baseline gap-1 font-mono text-3xl text-e4-gold sm:text-4xl">
                <CountUp
                  to={stat.value}
                  duration={1.6}
                  digitEffect="slide"
                  separator="."
                  className="font-mono"
                />
                {stat.suffix ? (
                  <span className="text-2xl text-e4-gold-deep">
                    {stat.suffix}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 font-display text-sm font-semibold uppercase tracking-wide text-e4-silver">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
