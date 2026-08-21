export type BetaInviteStatus = 'unused' | 'redeemed' | 'revoked'

export type BetaInviteKey = {
  id: string
  code: string
  status: BetaInviteStatus
  created_by: string | null
  created_at: string
  redeemed_at: string | null
  redeemed_discord_id: string | null
  redeemed_discord_username: string | null
  redeemed_discord_avatar_url: string | null
  game_code: string | null
  fivem_account_id: number | null
  fivem_license: string | null
  fivem_discord: string | null
}
