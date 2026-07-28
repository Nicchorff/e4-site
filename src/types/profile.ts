export type AppRole = 'member' | 'staff' | 'admin'

export type Profile = {
  id: string
  discord_id: string
  username: string
  avatar_url: string | null
  role: AppRole
  created_at: string
  updated_at: string
}
