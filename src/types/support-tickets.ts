export type SupportTicketKind = 'duvida' | 'suporte' | 'reporte'
export type AdminTicketKind = SupportTicketKind | 'doacao'
export type TicketStatus = 'open' | 'in_progress' | 'finished'

export type AdminTicket = {
  id: string
  source: 'support' | 'donation'
  kind: AdminTicketKind
  status: TicketStatus
  subject: string
  body: string
  openerDiscordId: string
  openerUsername: string
  claimedByDiscordId: string | null
  createdAt: string
  finishedAt: string | null
  discordChannelId: string
  orderId?: string
}
