import { Link } from 'react-router-dom'

type PlaceholderPageProps = {
  title: string
  description?: string
}

export function PlaceholderPage({
  title,
  description = 'Esta seção será implementada nas próximas fases do PRD.',
}: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <p className="font-pixel-badge text-e4-gold">EM BREVE</p>
      <h1 className="text-3xl text-e4-white sm:text-4xl">{title}</h1>
      <p className="text-e4-silver">{description}</p>
      <Link
        to="/"
        className="mt-2 font-display text-sm font-semibold uppercase tracking-wide text-e4-gold hover:underline"
      >
        Voltar para a Home
      </Link>
    </section>
  )
}
