import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { AdminTicket, TicketStatus } from '@/types/support-tickets'

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado')
  }
}

type SupportRow = {
  id: string
  kind: 'duvida' | 'suporte' | 'reporte'
  status: TicketStatus
  discord_user_id: string
  discord_username: string
  subject: string
  body: string | null
  claimed_by_discord_id: string | null
  created_at: string
  finished_at: string | null
  discord_channel_id: string
}

type DonationRow = {
  id: string
  order_id: string
  user_id: string
  status: TicketStatus
  claimed_by_discord_id: string | null
  created_at: string
  finished_at: string | null
  discord_channel_id: string
}

export async function fetchAdminGuildId(): Promise<string | null> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('discord_runtime_config')
    .select('guild_id')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data?.guild_id ? String(data.guild_id) : null
}

export async function fetchAdminTickets(): Promise<AdminTicket[]> {
  ensureConfigured()

  const [supportRes, donationRes] = await Promise.all([
    supabase
      .from('support_tickets')
      .select(
        'id, kind, status, discord_user_id, discord_username, subject, body, claimed_by_discord_id, created_at, finished_at, discord_channel_id',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('donation_tickets')
      .select(
        'id, order_id, user_id, status, claimed_by_discord_id, created_at, finished_at, discord_channel_id',
      )
      .order('created_at', { ascending: false }),
  ])

  if (supportRes.error) throw supportRes.error
  if (donationRes.error) throw donationRes.error

  const supportRows = (supportRes.data ?? []) as SupportRow[]
  const donationRows = (donationRes.data ?? []) as DonationRow[]

  const userIds = [...new Set(donationRows.map((row) => row.user_id))]
  const profilesById = new Map<
    string,
    { username: string | null; discord_id: string | null }
  >()
  if (userIds.length > 0) {
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, discord_id')
      .in('id', userIds)
    if (profileErr) throw profileErr
    for (const profile of profiles ?? []) {
      profilesById.set(profile.id, {
        username: profile.username ?? null,
        discord_id: profile.discord_id ?? null,
      })
    }
  }

  const supportTickets: AdminTicket[] = supportRows.map((row) => ({
    id: row.id,
    source: 'support',
    kind: row.kind,
    status: row.status,
    subject: row.subject,
    body: row.body ?? '',
    openerDiscordId: row.discord_user_id,
    openerUsername: row.discord_username,
    claimedByDiscordId: row.claimed_by_discord_id,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    discordChannelId: row.discord_channel_id,
  }))

  const donationTickets: AdminTicket[] = donationRows.map((row) => {
    const profile = profilesById.get(row.user_id)
    const shortOrder = row.order_id.replace(/-/g, '').slice(0, 8)
    return {
      id: row.id,
      source: 'donation',
      kind: 'doacao',
      status: row.status,
      subject: `Doação · ${shortOrder}`,
      body: `Pedido \`${row.order_id}\``,
      openerDiscordId: profile?.discord_id ?? '',
      openerUsername: profile?.username ?? 'doador',
      claimedByDiscordId: row.claimed_by_discord_id,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      discordChannelId: row.discord_channel_id,
      orderId: row.order_id,
    }
  })

  return [...supportTickets, ...donationTickets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function closeSupportTicketFromSite(
  ticketId: string,
): Promise<void> {
  ensureConfigured()
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean
    error?: string
  }>('support-ticket-moderate', {
    method: 'POST',
    body: { ticketId },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
}

export function ticketChannelUrl(
  guildId: string | null,
  channelId: string,
): string | null {
  if (!guildId || !channelId) return null
  return `https://discord.com/channels/${guildId}/${channelId}`
}
