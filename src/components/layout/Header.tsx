import { NavLink, Link } from 'react-router-dom'
import { Shield, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { RoleBadge } from '@/components/auth/RoleBadge'
import { Button } from '@/components/ui/button'
import { getDiscordInviteUrl } from '@/lib/home-content'
import { formatBrl } from '@/types/store'

const nav = [
  { to: '/', label: 'Home', end: true },
  { to: '/regras', label: 'Regras' },
  { to: '/loja', label: 'Loja' },
]

export function Header() {
  const { user, profile, isAdmin, signInWithDiscord, configured } = useAuth()
  const { itemCount, totalCents } = useCart()
  const discordInvite = getDiscordInviteUrl()

  return (
    <header className="sticky top-0 z-50 border-b border-e4-gold-deep/30 bg-e4-black/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <NavLink to="/" className="flex min-h-11 shrink-0 items-center gap-2">
          <img
            src="/e4-logo.png"
            alt="Elite Four"
            className="h-9 w-auto sm:h-10"
          />
          <span className="font-display text-lg font-bold tracking-wider text-e4-gold sm:text-xl">
            E4
          </span>
        </NavLink>

        <nav
          className="flex items-center gap-0.5 sm:gap-2"
          aria-label="Principal"
        >
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-11 items-center rounded-md px-2 py-1.5 font-display text-xs font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:text-base',
                  isActive
                    ? 'bg-e4-gold/15 text-e4-gold'
                    : 'text-e4-silver hover:text-e4-white',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'hidden min-h-11 items-center rounded-md px-2 py-1.5 font-display text-sm font-semibold uppercase tracking-wide sm:inline-flex',
                  isActive
                    ? 'bg-e4-gold/15 text-e4-gold'
                    : 'text-e4-gold hover:text-e4-white',
                )
              }
            >
              Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-e4-gold-deep/50 text-e4-gold hover:border-e4-gold sm:hidden"
              aria-label="Painel admin"
            >
              <Shield className="size-4" />
            </Link>
          )}

          <Link
            to="/loja/carrinho"
            className="relative inline-flex min-h-11 items-center gap-1.5 rounded-md border border-e4-gold-deep/50 px-2.5 py-1.5 text-e4-silver hover:border-e4-gold hover:text-e4-gold"
            aria-label={
              itemCount > 0
                ? `Carrinho, ${itemCount} itens, ${formatBrl(totalCents)}`
                : 'Carrinho'
            }
          >
            <ShoppingCart className="size-4" />
            {itemCount > 0 && (
              <span className="hidden font-mono text-xs text-e4-gold sm:inline">
                {formatBrl(totalCents)}
              </span>
            )}
            {itemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-e4-gold px-1 font-mono text-[0.65rem] font-bold text-e4-black">
                {itemCount}
              </span>
            )}
          </Link>

          <a
            href={discordInvite}
            target="_blank"
            rel="noreferrer"
            className="hidden min-h-11 items-center rounded-md border border-e4-gold-deep/50 px-2.5 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-e4-silver hover:text-e4-white sm:inline-flex"
          >
            Discord
          </a>

          {user && profile ? (
            <Link
              to="/perfil"
              className="flex min-h-11 max-w-[7.5rem] items-center gap-2 rounded-md border border-e4-gold-deep/40 bg-e4-black-soft px-2 py-1 hover:border-e4-gold sm:max-w-[9rem]"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-7 w-7 rounded-full"
                />
              ) : null}
              <span className="truncate font-display text-xs font-semibold text-e4-white">
                {profile.username}
              </span>
              {profile.role === 'admin' && (
                <RoleBadge role="admin" className="hidden sm:inline-flex" />
              )}
            </Link>
          ) : configured ? (
            <Button
              size="sm"
              className="min-h-11 bg-e4-gold font-display text-xs font-bold uppercase text-e4-black hover:bg-e4-gold-deep hover:text-white"
              onClick={() => void signInWithDiscord()}
            >
              Entrar
            </Button>
          ) : (
            <Link
              to="/perfil"
              className="inline-flex min-h-11 items-center font-display text-xs font-semibold uppercase text-e4-gold"
            >
              Perfil
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
