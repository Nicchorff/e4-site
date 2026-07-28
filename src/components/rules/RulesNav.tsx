import { cn } from '@/lib/utils'
import type { RulesSection } from '@/types/rules'

type RulesNavProps = {
  sections: RulesSection[]
  activeSlug: string
  onSelect: (slug: string) => void
}

export function RulesNav({ sections, activeSlug, onSelect }: RulesNavProps) {
  return (
    <>
      {/* Mobile tabs */}
      <nav
        className="mb-6 flex gap-2 overflow-x-auto pb-1 sm:hidden"
        aria-label="Seções das regras"
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.slug)}
            className={cn(
              'shrink-0 rounded-md border px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-wide transition',
              activeSlug === section.slug
                ? 'border-e4-gold bg-e4-gold/15 text-e4-gold'
                : 'border-e4-gold-deep/40 text-e4-silver hover:text-e4-white',
            )}
          >
            {section.title}
          </button>
        ))}
      </nav>

      {/* Desktop sidebar */}
      <nav
        className="sticky top-20 hidden w-52 shrink-0 self-start sm:block lg:w-56"
        aria-label="Seções das regras"
      >
        <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-e4-gold">
          Seções
        </p>
        <ul className="space-y-1 border-l border-e4-gold-deep/40">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.slug}`}
                onClick={(e) => {
                  e.preventDefault()
                  onSelect(section.slug)
                }}
                className={cn(
                  'block border-l-2 py-2 pl-3 font-display text-sm font-semibold uppercase tracking-wide transition',
                  activeSlug === section.slug
                    ? '-ml-px border-e4-gold text-e4-gold'
                    : 'border-transparent text-e4-silver hover:text-e4-white',
                )}
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
