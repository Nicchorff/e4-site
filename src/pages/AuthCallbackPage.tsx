import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/**
 * Handles the OAuth return URL. Supabase client parses the hash/query and
 * establishes the session; we then sync roles and redirect.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { refreshProfile, user } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase não configurado.')
      return
    }

    let cancelled = false

    async function finish() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (cancelled) return

      if (sessionError) {
        setError(sessionError.message)
        return
      }

      if (!session) {
        // Give the client a moment to hydrate from URL hash
        await new Promise((r) => setTimeout(r, 400))
        const again = await supabase.auth.getSession()
        if (!again.data.session) {
          setError('Sessão não encontrada após o login Discord.')
          return
        }
      }

      try {
        await refreshProfile()
      } catch {
        // Profile sync may fail if bot env is missing; still land on profile.
      }

      if (!cancelled) navigate('/perfil', { replace: true })
    }

    void finish()
    return () => {
      cancelled = true
    }
  }, [navigate, refreshProfile])

  if (error) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-2xl text-e4-dusk">Falha no login</h1>
        <p className="mt-2 text-sm text-e4-silver">{error}</p>
      </section>
    )
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-e4-silver">
      <p className="font-display text-lg text-e4-gold">
        {user ? 'Sincronizando cargos…' : 'Entrando com Discord…'}
      </p>
      <p className="text-sm">Aguarde um instante.</p>
    </div>
  )
}
