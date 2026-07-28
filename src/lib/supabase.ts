import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/types/profile'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (null as unknown as SupabaseClient)

export async function syncDiscordRoles(): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return null

  const { data, error } = await supabase.functions.invoke<{
    profile?: Profile
    error?: string
  }>('sync-discord-roles', {
    method: 'POST',
  })

  if (error) {
    console.error('sync-discord-roles failed', error)
    throw error
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data?.profile ?? null
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('fetchProfile failed', error)
    return null
  }

  return data as Profile | null
}
