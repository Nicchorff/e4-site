import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, user, configured } = useAuth()
  const location = useLocation()

  if (!configured) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16 text-e4-silver">
        <h1 className="font-display text-2xl text-e4-gold">Auth não configurado</h1>
        <p className="mt-2 text-sm">
          Defina <code className="font-mono text-e4-white">VITE_SUPABASE_URL</code> e{' '}
          <code className="font-mono text-e4-white">VITE_SUPABASE_ANON_KEY</code> no{' '}
          <code className="font-mono text-e4-white">.env</code>.
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-e4-silver">
        Carregando…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/perfil" replace state={{ from: location.pathname }} />
  }

  return children
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin, user } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-e4-silver">
        Carregando…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/perfil" replace />
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16">
        <p className="font-pixel-badge text-e4-dusk">ACESSO NEGADO</p>
        <h1 className="mt-3 font-display text-3xl text-e4-white">Só admins</h1>
        <p className="mt-2 text-e4-silver">
          Seu cargo no Discord não mapeia para <span className="text-e4-gold">admin</span>.
          Confirme o role ID e a Edge Function.
        </p>
      </section>
    )
  }

  return children
}
