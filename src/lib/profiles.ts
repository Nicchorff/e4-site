import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { AppRole, Profile } from '@/types/profile'

export async function fetchProfilesAdmin(): Promise<Profile[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as Profile[]) ?? []
}

export function filterProfiles(
  profiles: Profile[],
  opts: { role: AppRole | 'all'; query: string },
): Profile[] {
  const q = opts.query.trim().toLowerCase()
  return profiles.filter((p) => {
    if (opts.role !== 'all' && p.role !== opts.role) return false
    if (!q) return true
    return (
      p.username.toLowerCase().includes(q) ||
      p.discord_id.toLowerCase().includes(q)
    )
  })
}
