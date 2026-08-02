import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  fetchWhitelistApplications,
  moderateWhitelist,
} from '@/lib/whitelist'
import type { WhitelistApplication } from '@/types/whitelist'

export function AdminWhitelistEntrevistasPage() {
  useDocumentTitle('Admin · Whitelist entrevistas · Elite Four')
  const [apps, setApps] = useState<WhitelistApplication[]>([])
  const [selected, setSelected] = useState<WhitelistApplication | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setApps(await fetchWhitelistApplications(['interview']))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(action: 'approve_interview' | 'reject_interview') {
    if (!selected) return
    if (action === 'reject_interview' && !rejectReason.trim()) {
      setError('Informe o motivo da recusa.')
      return
    }
    setActing(true)
    setError(null)
    try {
      await moderateWhitelist({
        action,
        applicationId: selected.id,
        reason: rejectReason.trim() || undefined,
      })
      setSelected(null)
      setRejectReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na moderação')
    } finally {
      setActing(false)
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel-badge text-e4-gold">ADMIN</p>
          <h1 className="mt-1 font-display text-3xl text-e4-white">
            Whitelist · entrevistas
          </h1>
          <p className="mt-2 text-sm text-e4-silver">
            Aprovar libera whitelist no servidor e concede o cargo final.
            Recusar exige motivo.
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
            <Link to="/admin/whitelist/formularios">Formulários</Link>
          </Button>
          <Button asChild variant="outline" className="border-e4-gold-deep/50">
            <Link to="/admin">Voltar</Link>
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-e4-dusk/40 bg-e4-dusk/10 px-3 py-2 text-sm text-e4-dusk">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-e4-silver">Carregando…</p>
      ) : apps.length === 0 ? (
        <p className="mt-8 text-e4-silver">Nenhuma entrevista na fila.</p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <li key={app.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(app)
                  setRejectReason('')
                  setError(null)
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-3 text-left transition hover:border-e4-gold"
              >
                <img
                  src={
                    app.discord_avatar_url ||
                    `https://cdn.discordapp.com/embed/avatars/0.png`
                  }
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate font-display text-e4-white">
                    {app.discord_username}
                  </p>
                  <p className="truncate text-xs text-e4-silver">
                    {app.discord_id}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-lg border border-e4-gold-deep/40 bg-e4-black p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <img
                src={
                  selected.discord_avatar_url ||
                  `https://cdn.discordapp.com/embed/avatars/0.png`
                }
                alt=""
                className="h-14 w-14 rounded-full"
              />
              <div>
                <h2 className="font-display text-xl text-e4-white">
                  {selected.discord_username}
                </h2>
                <p className="text-xs text-e4-silver">{selected.discord_id}</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-e4-silver">
              Sem detalhes do formulário nesta etapa — apenas aprovar ou
              recusar a entrevista.
            </p>

            <label className="mt-4 block space-y-2">
              <span className="text-xs font-display uppercase text-e4-silver">
                Motivo (obrigatório se recusar)
              </span>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="border-e4-gold-deep/40 bg-e4-black-soft"
              />
            </label>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                disabled={acting}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => void act('approve_interview')}
              >
                Aprovar
              </Button>
              <Button
                disabled={acting}
                variant="outline"
                className="border-e4-dusk/60 text-e4-dusk"
                onClick={() => void act('reject_interview')}
              >
                Recusar
              </Button>
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
