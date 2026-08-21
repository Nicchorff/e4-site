import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  createBetaInviteKeys,
  fetchBetaInviteKeys,
  revokeBetaInviteKey,
} from '@/lib/beta-invites'
import type { BetaInviteKey, BetaInviteStatus } from '@/types/beta-invites'

const STATUS_FILTERS: Array<BetaInviteStatus | 'all'> = [
  'all',
  'unused',
  'redeemed',
  'revoked',
]

const STATUS_LABEL: Record<BetaInviteStatus, string> = {
  unused: 'livre',
  redeemed: 'vinculada',
  revoked: 'revogada',
}

function formatWhen(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleString('pt-BR')
}

export function AdminConvitesPage() {
  useDocumentTitle('Admin · Convites · Elite Four')
  const { user } = useAuth()
  const [keys, setKeys] = useState<BetaInviteKey[]>([])
  const [count, setCount] = useState(1)
  const [filter, setFilter] = useState<BetaInviteStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [createdCodes, setCreatedCodes] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setKeys(await fetchBetaInviteKeys())
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
    () => (filter === 'all' ? keys : keys.filter((k) => k.status === filter)),
    [keys, filter],
  )

  async function handleGenerate() {
    if (!user?.id) {
      setError('Sessão inválida')
      return
    }
    setSaving(true)
    setError(null)
    setCreatedCodes([])
    try {
      const created = await createBetaInviteKeys({
        count,
        createdBy: user.id,
      })
      setCreatedCodes(created.map((k) => k.code))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar keys')
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(id: string) {
    setSaving(true)
    setError(null)
    try {
      await revokeBetaInviteKey(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao revogar')
    } finally {
      setSaving(false)
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setError('Não foi possível copiar')
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel-badge text-e4-gold">ADMIN</p>
          <h1 className="mt-1 font-display text-3xl text-e4-white">Convites</h1>
          <p className="mt-2 max-w-xl text-sm text-e4-silver">
            Keys do beta fechado. Cada código vale uma vez. No Discord a
            pessoa informa a key + o ID do jogo; o vínculo aparece aqui.
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
            <Link to="/admin">Voltar</Link>
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-e4-dusk/40 bg-e4-dusk/10 px-3 py-2 text-sm text-e4-dusk">
          {error}
        </p>
      )}

      <form
        className="mt-8 flex flex-wrap items-end gap-3 rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void handleGenerate()
        }}
      >
        <label className="text-sm text-e4-silver">
          Quantidade
          <Input
            className="mt-1 w-28"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
          />
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? 'Gerando…' : 'Gerar keys'}
        </Button>
        {createdCodes.length > 0 && (
          <Button
            type="button"
            variant="outline"
            className="border-e4-gold-deep/50"
            onClick={() => void copyText(createdCodes.join('\n'))}
          >
            Copiar geradas
          </Button>
        )}
      </form>

      {createdCodes.length > 0 && (
        <pre className="mt-3 overflow-x-auto rounded-md border border-e4-gold-deep/30 bg-e4-black p-3 text-sm text-e4-gold">
          {createdCodes.join('\n')}
        </pre>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((item) => (
          <Button
            key={item}
            type="button"
            variant={filter === item ? 'default' : 'outline'}
            className="border-e4-gold-deep/50"
            onClick={() => setFilter(item)}
          >
            {item === 'all' ? 'todas' : STATUS_LABEL[item]}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-e4-silver">Carregando…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-e4-silver">Nenhuma key neste filtro.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {visible.map((key) => (
            <li
              key={key.id}
              className="rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg text-e4-gold">{key.code}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-e4-silver">
                    {STATUS_LABEL[key.status]} · {formatWhen(key.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-e4-gold-deep/50"
                    onClick={() => void copyText(key.code)}
                  >
                    {copied === key.code ? 'Copiado' : 'Copiar'}
                  </Button>
                  {key.status === 'unused' && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-e4-dusk/50 text-e4-dusk"
                      disabled={saving}
                      onClick={() => void handleRevoke(key.id)}
                    >
                      Revogar
                    </Button>
                  )}
                </div>
              </div>
              {key.status === 'redeemed' && (
                <div className="mt-3 flex items-center gap-3 text-sm text-e4-silver">
                  <img
                    src={
                      key.redeemed_discord_avatar_url ||
                      'https://cdn.discordapp.com/embed/avatars/0.png'
                    }
                    alt=""
                    className="h-9 w-9 rounded-full"
                  />
                  <div>
                    <p className="text-e4-white">
                      {key.redeemed_discord_username || 'Discord'}{' '}
                      <span className="text-e4-silver">
                        ({key.redeemed_discord_id})
                      </span>
                    </p>
                    <p>
                      ID jogo {key.game_code} · conta #{key.fivem_account_id} ·
                      license {key.fivem_license} · discord FiveM{' '}
                      {key.fivem_discord}
                    </p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
