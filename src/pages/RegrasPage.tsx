import { useEffect, useState } from 'react'
import { RulesMarkdown } from '@/components/rules/RulesMarkdown'
import { RulesNav } from '@/components/rules/RulesNav'
import { fetchPublishedRules } from '@/lib/rules'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { RULES_FALLBACK, type RulesSection } from '@/types/rules'

export function RegrasPage() {
  useDocumentTitle('Regras · Elite Four')
  const [sections, setSections] = useState<RulesSection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSlug, setActiveSlug] = useState('')

  useEffect(() => {
    let cancelled = false
    void fetchPublishedRules().then((data) => {
      if (cancelled) return
      const list = data.length > 0 ? data : RULES_FALLBACK
      setSections(list)
      setActiveSlug(list[0]?.slug ?? '')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeSlug) return
    const el = document.getElementById(activeSlug)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeSlug])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-e4-silver">
        Carregando regras…
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-3xl text-e4-white">Regras</h1>
        <p className="mt-3 text-e4-silver">
          Nenhuma seção publicada no momento.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 max-w-2xl">
        <p className="font-pixel-badge text-e4-gold">REGULAMENTO</p>
        <h1 className="mt-2 font-display text-3xl text-e4-white sm:text-4xl">
          Regras do servidor
        </h1>
        <p className="mt-3 text-e4-silver">
          Leia com atenção. O conteúdo é atualizado pela staff sem precisar de
          novo deploy.
        </p>
      </header>

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
        <RulesNav
          sections={sections}
          activeSlug={activeSlug}
          onSelect={setActiveSlug}
        />

        <div className="min-w-0 flex-1 space-y-6">
          {sections.map((section) => (
            <article
              key={section.id}
              id={section.slug}
              className="scroll-mt-24 rounded-lg border border-e4-gold-deep/35 bg-e4-black-soft p-5 sm:p-6"
            >
              <h2 className="font-display text-2xl font-bold text-e4-gold">
                {section.title}
              </h2>
              <div className="mt-4">
                <RulesMarkdown content={section.body_md} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
