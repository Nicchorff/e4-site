import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TextReveal } from '@/components/unlumen-ui/text-reveal'
import { MagneticButton } from '@/components/unlumen-ui/magnetic-button'
import { getDiscordInviteUrl } from '@/lib/home-content'

type HomeHeroProps = {
  headline: string
  subtitle: string
}

const POSTER = '/e4-hero-poster.jpg'
const WEBM = '/e4-hero.webm'
const MP4 = '/e4-hero.mp4'
const GIF = '/e4-hero.gif'

export function HomeHero({ headline, subtitle }: HomeHeroProps) {
  const navigate = useNavigate()
  const discordUrl = getDiscordInviteUrl()
  const [preferVideo, setPreferVideo] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Prefer webm when the asset exists (after ffmpeg convert); otherwise GIF.
    void fetch(WEBM, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled && res.ok) setPreferVideo(true)
      })
      .catch(() => {
        /* gif fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const showVideo = preferVideo && !videoFailed

  return (
    <section className="relative isolate min-h-[88svh] overflow-hidden">
      <div className="absolute inset-0 bg-e4-black" aria-hidden />

      {showVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={POSTER}
          preload="metadata"
          onError={() => setVideoFailed(true)}
          aria-hidden
        >
          <source src={WEBM} type="video/webm" />
          <source src={MP4} type="video/mp4" />
        </video>
      ) : (
        <img
          src={GIF}
          alt=""
          width={268}
          height={268}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
      )}

      {/* Poster underlay while video buffers */}
      <img
        src={POSTER}
        alt=""
        width={268}
        height={268}
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        aria-hidden
      />

      <div
        className="absolute inset-0 bg-gradient-to-t from-e4-black via-e4-black/75 to-e4-black/25"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[88svh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20">
        <p className="mb-3 font-display text-sm font-bold uppercase tracking-[0.28em] text-e4-gold sm:text-base">
          Elite Four
        </p>

        <TextReveal
          as="h1"
          text={headline}
          className="max-w-2xl font-display text-4xl font-bold leading-tight text-e4-white sm:text-5xl md:text-6xl"
          staggerDelay={0.04}
          duration={0.45}
        />

        <p className="mt-4 max-w-xl text-base text-e4-silver sm:text-lg">
          {subtitle}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <MagneticButton
            size="lg"
            className="min-h-11 bg-e4-gold font-display text-base font-bold uppercase tracking-wide text-e4-black hover:bg-e4-gold-deep hover:text-e4-white"
            onClick={() => window.open(discordUrl, '_blank', 'noreferrer')}
          >
            Entrar no servidor
          </MagneticButton>
          <MagneticButton
            size="lg"
            variant="outline"
            className="min-h-11 border-e4-gold-deep bg-transparent font-display text-base font-bold uppercase tracking-wide text-e4-gold hover:bg-e4-gold/10 hover:text-e4-gold"
            onClick={() => navigate('/loja')}
          >
            Ver loja
          </MagneticButton>
        </div>
      </div>
    </section>
  )
}
