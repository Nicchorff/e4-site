import { useEffect, useState } from 'react'
import { HomeHero } from '@/components/home/HomeHero'
import { HomeStats } from '@/components/home/HomeStats'
import { HomeRulesTeaser } from '@/components/home/HomeRulesTeaser'
import { HomeShopPreview } from '@/components/home/HomeShopPreview'
import { HomeTestimonials } from '@/components/home/HomeTestimonials'
import { fetchHomeContent } from '@/lib/home-content'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { HOME_FALLBACK, type HomeContent } from '@/types/home'

export function HomePage() {
  useDocumentTitle('Home · Elite Four')
  const [content, setContent] = useState<HomeContent>(HOME_FALLBACK)

  useEffect(() => {
    let cancelled = false
    void fetchHomeContent().then((data) => {
      if (!cancelled) setContent(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <HomeHero
        headline={content.heroHeadline}
        subtitle={content.heroSubtitle}
      />
      <div className="h-8 bg-e4-black-soft e4-facet-divider" aria-hidden />
      <HomeStats stats={content.stats} />
      <div className="h-6 bg-e4-black e4-facet-edge" aria-hidden />
      <HomeRulesTeaser items={content.rulesTeasers} />
      <div className="h-6 bg-e4-black-soft e4-facet-divider" aria-hidden />
      <HomeShopPreview />
      <div className="h-6 bg-e4-black e4-facet-edge" aria-hidden />
      <HomeTestimonials items={content.testimonials} />
    </div>
  )
}
