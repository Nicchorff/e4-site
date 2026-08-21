import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  closeSupportTicketFromSite,
  fetchAdminGuildId,
  fetchAdminTickets,
  ticketChannelUrl,
} from '@/lib/support-tickets'
import type {
  AdminTicket,
  AdminTicketKind,
  TicketStatus,
} from '@/types/support-tickets'

const KIND_FILTERS: Array<AdminTicketKind | 'all'> = [
  'all',
  'duvida',
  'suporte',
  'reporte',
  'doacao',
]

const STATUS_FILTERS: Array<TicketStatus | 'all'> = [
  'all',
  'open',
  'in_progress',
  'finished',
]

const KIND_LABEL: Record<AdminTicketKind, string> = {
  duvida: 'Dúvida',
  suporte: 'Suporte',
  reporte: 'Reporte',
  doacao: 'Doação',
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'aberto',
  in_progress: 'em andamento',
  finished: 'finalizado',
}

function formatWhen(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

export function AdminTicketsPage() {
  useDocumentTitle('Admin · Tickets · Elite Four')
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [guildId, setGuildId] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<AdminTicketKind | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>(
    'open',
  )
  const [selected, setSelected] = useState<AdminTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, guild] = await Promise.all([
        fetchAdminTickets(),
        fetchAdminGuildId(),
      ])
      setTickets(rows)
      setGuildId(guild)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (kindFilter !== 'all' && ticket.kind !== kindFilter) return false
        if (statusFilter !== 'all' && ticket.status !== statusFilter) {
          return false
        }
        return true
      }),
    [tickets, kindFilter, statusFilter],
  )

  async function handleClose(ticket: AdminTicket) {
    if (ticket.source !== 'support') return
    setActing(true)
    setError(null)
    try {
      await closeSupportTicketFromSite(ticket.id)
      setSelected(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao encerrar')
    } finally {
      setActing(false)
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel-badge text-e4-gold">ADMIN</p>
          <h1 className="mt-1 font-display text-3xl text-e4-white">Tickets</h1>
          <p className="mt-2 text-sm text-e4-silver">
            Fila de dúvida, suporte, reporte e doações. O atendimento continua
            no Discord; aqui você acompanha status e pode encerrar tickets de
            suporte.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-e4-gold-deep/50"
            onClick={() => void load()}
          >
            Atualizar
          </Button>
          <Button asChild variant="outline" className="border-e4-gold-deep/50">
            <Link to="/admin/doacoes">Cargos</Link>
          </Button>
          <Button asChild variant="outline" className="border-e4-gold-deep/50">
            <Link to="/admin">Voltar</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <label className="space-y-1 text-xs">
          <span className="font-display uppercase text-e4-gold">Tipo</span>
          <select
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as AdminTicketKind | 'all')
            }
            className="block rounded-md border border-e4-gold-deep/40 bg-e4-black px-2 py-1 text-sm text-e4-white"
          >
            {KIND_FILTERS.map((kind) => (
              <option key={kind} value={kind}>
                {kind === 'all' ? 'Todos' : KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-display uppercase text-e4-gold">Status</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as TicketStatus | 'all')
            }
            className="block rounded-md border border-e4-gold-deep/40 bg-e4-black px-2 py-1 text-sm text-e4-white"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'Todos' : STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-e4-dusk/40 bg-e4-dusk/10 px-3 py-2 text-sm text-e4-dusk">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-e4-silver">Carregando…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-e4-silver">Nenhum ticket neste filtro.</p>
      ) : (
        <ul className="mt-8 divide-y divide-e4-gold-deep/20 rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft">
          {visible.map((ticket) => {
            const url = ticketChannelUrl(guildId, ticket.discordChannelId)
            return (
              <li key={`${ticket.source}-${ticket.id}`}>
                <button
                  type="button"
                  onClick={() => setSelected(ticket)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-e4-gold/5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-e4-white">
                      {ticket.subject}
                    </p>
                    <p className="text-xs text-e4-silver">
                      {KIND_LABEL[ticket.kind]} · {ticket.openerUsername}
                      {ticket.claimedByDiscordId
                        ? ` · assumido`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span className="text-e4-gold">
                      {STATUS_LABEL[ticket.status]}
                    </span>
                    <span className="text-e4-silver">
                      {formatWhen(ticket.createdAt)}
                    </span>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-e4-gold underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Discord
                      </a>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-e4-gold-deep/40 bg-e4-black p-5 shadow-xl">
            <p className="font-pixel-badge text-e4-gold">
              {KIND_LABEL[selected.kind]}
            </p>
            <h2 className="mt-1 font-display text-xl text-e4-white">
              {selected.subject}
            </h2>
            <p className="mt-2 text-sm text-e4-silver">
              Aberto por {selected.openerUsername}
              {selected.openerDiscordId
                ? ` (${selected.openerDiscordId})`
                : ''}
            </p>
            <p className="text-sm text-e4-silver">
              Status: {STATUS_LABEL[selected.status]}
              {selected.claimedByDiscordId
                ? ` · assumido por ${selected.claimedByDiscordId}`
                : ''}
            </p>
            <p className="mt-4 whitespace-pre-wrap text-sm text-e4-white">
              {selected.body || '—'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {ticketChannelUrl(guildId, selected.discordChannelId) && (
                <Button asChild className="bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white">
                  <a
                    href={
                      ticketChannelUrl(guildId, selected.discordChannelId) ??
                      '#'
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir no Discord
                  </a>
                </Button>
              )}
              {selected.source === 'support' &&
                selected.status !== 'finished' && (
                  <Button
                    disabled={acting}
                    variant="outline"
                    className="border-e4-dusk/60 text-e4-dusk"
                    onClick={() => void handleClose(selected)}
                  >
                    {acting ? 'Encerrando…' : 'Encerrar'}
                  </Button>
                )}
              {selected.source === 'donation' &&
                selected.status !== 'finished' && (
                  <p className="self-center text-xs text-e4-silver">
                    Doação: use /comprovante-aprovado no Discord.
                  </p>
                )}
              <Button
                disabled={acting}
                variant="outline"
                className="border-e4-gold-deep/50"
                onClick={() => setSelected(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
