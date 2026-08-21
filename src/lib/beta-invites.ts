import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { BetaInviteKey } from '@/types/beta-invites'

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado')
  }
}

function randomSegment(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''
  for (let i = 0; i < length; i++) {
    out += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length]
  }
  return out
}

export function generateBetaInviteCode() {
  return `E4-${randomSegment(4)}-${randomSegment(4)}`
}

export async function fetchBetaInviteKeys(): Promise<BetaInviteKey[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('beta_invite_keys')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as BetaInviteKey[]
}

export async function createBetaInviteKeys(input: {
  count: number
  createdBy: string
}): Promise<BetaInviteKey[]> {
  ensureConfigured()
  const count = Math.min(50, Math.max(1, Math.floor(input.count)))
  const created: BetaInviteKey[] = []

  for (let attempt = 0; attempt < count * 8 && created.length < count; attempt++) {
    const code = generateBetaInviteCode()
    const { data, error } = await supabase
      .from('beta_invite_keys')
      .insert({
        code,
        status: 'unused',
        created_by: input.createdBy,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') continue
      throw error
    }
    created.push(data as BetaInviteKey)
  }

  if (created.length < count) {
    throw new Error('Não foi possível gerar todas as keys. Tente de novo.')
  }

  return created
}

export async function revokeBetaInviteKey(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase
    .from('beta_invite_keys')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('status', 'unused')

  if (error) throw error
}
