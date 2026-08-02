import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  fetchWhitelistAnswers,
  fetchWhitelistApplications,
  moderateWhitelist,
} from '@/lib/whitelist'
import type { WhitelistAnswer, WhitelistApplication } from '@/types/whitelist'

export function AdminWhitelistFormulariosPage() {
  useDocumentTitle('Admin · Whitelist formulários · Elite Four')
  const [apps, setApps] = useState<WhitelistApplication[]>([])
  const [selected, setSelected] = useState<WhitelistApplication | null>(null)
  const [answers, setAnswers] = useState<WhitelistAnswer[]>([])
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setApps(await fetchWhitelistApplications(['pending_review']))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function openDetail(app: WhitelistApplication) {
    setSelected(app)
    setRejectReason('')
    setError(null)
    try {
      setAnswers(await fetchWhitelistAnswers(app.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar respostas')
    }
  }

  async function act(action: 'approve_form' | 'reject_form') {
    if (!selected) return
    setActing(true)
    setError(null)
    try {
      await moderateWhitelist({
        action,
        applicationId: selected.id,
        reason: rejectReason || undefined,
      })
      setSelected(null)
      setAnswers([])
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
            Whitelist · formulários
          </h1>
          <p className="mt-2 text-sm text-e4-silver">
            Revisões pendentes. Clique no perfil para ver as respostas.
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
            <Link to="/admin/whitelist/entrevistas">Entrevistas</Link>
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
        <p className="mt-8 text-e4-silver">Nenhum formulário pendente.</p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <li key={app.id}>
              <button
                type="button"
                onClick={() => void openDetail(app)}
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
                  <p className="font-mono text-xs text-e4-gold">
                    Código {app.game_code}
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-e4-gold-deep/40 bg-e4-black p-5 shadow-xl">
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
                <p className="font-mono text-sm text-e4-gold">
                  Código {selected.game_code}
                </p>
              </div>
            </div>

            <ol className="mt-6 space-y-4">
              {answers.map((a, i) => (
                <li key={a.id} className="border-b border-e4-gold-deep/20 pb-3">
                  <p className="text-xs font-display uppercase text-e4-gold">
                    {i + 1}. {a.question_prompt}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-e4-silver">
                    {a.answer_text}
                  </p>
                </li>
              ))}
              {answers.length === 0 && (
                <p className="text-sm text-e4-silver">Sem respostas.</p>
              )}
            </ol>

            <label className="mt-4 block space-y-2">
              <span className="text-xs font-display uppercase text-e4-silver">
                Motivo (opcional na recusa)
              </span>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                className="border-e4-gold-deep/40 bg-e4-black-soft"
              />
            </label>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                disabled={acting}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => void act('approve_form')}
              >
                Aprovar
              </Button>
              <Button
                disabled={acting}
                variant="outline"
                className="border-e4-dusk/60 text-e4-dusk"
                onClick={() => void act('reject_form')}
              >
                Recusar
              </Button>
              <Button
                disabled={acting}
                variant="outline"
                className="border-e4-gold-deep/50"
                onClick={() => {
                  setSelected(null)
                  setAnswers([])
                }}
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
