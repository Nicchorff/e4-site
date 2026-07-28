import { Link } from 'react-router-dom'
import { getDiscordInviteUrl } from '@/lib/home-content'

export function Footer() {
  const discordUrl = getDiscordInviteUrl()
  const instagramUrl =
    (import.meta.env.VITE_INSTAGRAM_URL as string | undefined) || '#'
  const tiktokUrl =
    (import.meta.env.VITE_TIKTOK_URL as string | undefined) || '#'

  return (
    <footer className="border-t border-e4-gold-deep/30 bg-e4-black-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="space-y-2">
          <img src="/e4-logo.png" alt="Elite Four" className="h-10 w-auto" />
          <p className="max-w-xs text-sm text-e4-silver">
            Elite Four — servidor FiveM de RP temático de Pokémon.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm">
          <div className="space-y-2">
            <p className="font-display font-semibold uppercase tracking-wide text-e4-gold">
              Site
            </p>
            <ul className="space-y-1 text-e4-silver">
              <li>
                <Link to="/regras" className="hover:text-e4-white">
                  Regras
                </Link>
              </li>
              <li>
                <Link to="/loja" className="hover:text-e4-white">
                  Loja
                </Link>
              </li>
              <li>
                <Link to="/perfil" className="hover:text-e4-white">
                  Perfil
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-display font-semibold uppercase tracking-wide text-e4-gold">
              Redes
            </p>
            <ul className="space-y-1 text-e4-silver">
              <li>
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-e4-white"
                >
                  Discord
                </a>
              </li>
              <li>
                <a
                  href={instagramUrl}
                  target={instagramUrl === '#' ? undefined : '_blank'}
                  rel="noreferrer"
                  className="hover:text-e4-white"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href={tiktokUrl}
                  target={tiktokUrl === '#' ? undefined : '_blank'}
                  rel="noreferrer"
                  className="hover:text-e4-white"
                >
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-e4-gold-deep/20 px-4 py-4 text-center text-xs text-e4-silver/70">
        © {new Date().getFullYear()} Elite Four. Todos os direitos reservados.
        <span className="mt-1 block">
          Pagamentos da loja processados pela Stripe.
        </span>
      </div>
    </footer>
  )
}
