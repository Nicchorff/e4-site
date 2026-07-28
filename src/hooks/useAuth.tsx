import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '@/types/profile'
import {
  fetchProfile,
  isSupabaseConfigured,
  supabase,
  syncDiscordRoles,
} from '@/lib/supabase'

type AuthContextValue = {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  isStaff: boolean
  signInWithDiscord: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const loadProfile = useCallback(async (user: User) => {
    try {
      const synced = await syncDiscordRoles()
      if (synced) {
        setProfile(synced)
        return
      }
      const existing = await fetchProfile(user.id)
      setProfile(existing)
    } catch (err) {
      console.error(err)
      const existing = await fetchProfile(user.id)
      setProfile(existing)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        void loadProfile(data.session.user).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'SIGNED_IN' && nextSession?.user) {
        void loadProfile(nextSession.user)
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signInWithDiscord = useCallback(async () => {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
      )
    }

    const redirectTo = `${window.location.origin}/auth/discord/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo,
        scopes: 'identify email',
      },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return
    await loadProfile(session.user)
  }, [loadProfile, session?.user])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === 'admin',
      isStaff: profile?.role === 'staff' || profile?.role === 'admin',
      signInWithDiscord,
      signOut,
      refreshProfile,
    }),
    [
      loading,
      session,
      profile,
      signInWithDiscord,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
