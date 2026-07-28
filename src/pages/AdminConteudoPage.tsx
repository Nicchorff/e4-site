import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteStat,
  fetchAllStatsAdmin,
  fetchSiteContentAdmin,
  upsertSiteContent,
  upsertStat,
  type SiteContentMap,
} from '@/lib/home-content'
import type { SiteStat } from '@/types/home'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'

const emptyStat = {
  id: undefined as string | undefined,
  label: '',
  value: 0,
  suffix: '',
  display_order: 0,
}

export function AdminConteudoPage() {
  useDocumentTitle('Admin · Conteúdo · Elite Four')
  const [content, setContent] = useState<SiteContentMap | null>(null)
  const [stats, setStats] = useState<SiteStat[]>([])
  const [statForm, setStatForm] = useState(emptyStat)
  const [loading, setLoading] = useState(true)
  const [savingContent, setSavingContent] = useState(false)
  const [savingStat, setSavingStat] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, s] = await Promise.all([
        fetchSiteContentAdmin(),
        fetchAllStatsAdmin(),
      ])
      setContent(c)
      setStats(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const nextOrder = useMemo(() => {
    if (stats.length === 0) return 1
    return Math.max(...stats.map((s) => s.display_order)) + 1
  }, [stats])

  function startCreateStat() {
    setStatForm({ ...emptyStat, display_order: nextOrder })
    setError(null)
    setOk(null)
  }

  function startEditStat(stat: SiteStat) {
    setStatForm({
      id: stat.id,
      label: stat.label,
      value: stat.value,
      suffix: stat.suffix,
      display_order: stat.display_order,
    })
    setError(null)
    setOk(null)
  }

  async function handleSaveContent(e: React.FormEvent) {
    e.preventDefault()
    if (!content) return
    setSavingContent(true)
    setError(null)
    setOk(null)
    try {
      await upsertSiteContent(content)
      setOk('Conteúdo da home salvo.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar conteúdo')
    } finally {
      setSavingContent(false)
    }
  }

  async function handleSaveStat(e: React.FormEvent) {
    e.preventDefault()
    if (!statForm.label.trim()) {
      setError('Label do stat é obrigatório.')
      return
    }
    setSavingStat(true)
    setError(null)
    setOk(null)
    try {
      await upsertStat({
        id: statForm.id,
        label: statForm.label,
        value: Number(statForm.value) || 0,
        suffix: statForm.suffix,
        display_order: Number(statForm.display_order) || 0,
      })
      setOk(statForm.id ? 'Stat atualizado.' : 'Stat criado.')
      await load()
      startCreateStat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar stat')
    } finally {
      setSavingStat(false)
    }
  }

  async function handleDeleteStat(id: string) {
    if (!window.confirm('Excluir este destaque numérico?')) return
    setError(null)
    try {
      await deleteStat(id)
      if (statForm.id === id) startCreateStat()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel-badge text-e4-gold">ADMIN</p>
          <h1 className="mt-1 font-display text-3xl text-e4-white">
            Conteúdo da home
          </h1>
          <p className="mt-2 text-sm text-e4-silver">
            Hero, teasers de regras e stats — mudanças em{' '}
            <Link to="/" className="text-e4-gold hover:underline">
              /
            </Link>{' '}
            sem deploy.
          </p>
        </div>
        <Button asChild variant="outline" className="border-e4-gold-deep/50">
          <Link to="/admin">Voltar</Link>
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-e4-dusk/50 bg-e4-dusk/10 px-3 py-2 text-sm text-e4-dusk">
          {error}
        </p>
      )}
      {ok && (
        <p className="mt-4 rounded-md border border-e4-gold/40 bg-e4-gold/10 px-3 py-2 text-sm text-e4-gold">
          {ok}
        </p>
      )}

      {loading || !content ? (
        <p className="mt-8 text-e4-silver">Carregando…</p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={(e) => void handleSaveContent(e)}
            className="space-y-4 rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-5"
          >
            <h2 className="font-display text-xl text-e4-gold">Hero & teasers</h2>
            <label className="block space-y-1.5 text-sm">
              <span className="text-e4-silver">Headline</span>
              <Input
                value={content.hero_headline}
                onChange={(e) =>
                  setContent((c) =>
                    c ? { ...c, hero_headline: e.target.value } : c,
                  )
                }
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-e4-silver">Subtítulo</span>
              <Textarea
                rows={3}
                value={content.hero_subtitle}
                onChange={(e) =>
                  setContent((c) =>
                    c ? { ...c, hero_subtitle: e.target.value } : c,
                  )
                }
              />
            </label>
            {([1, 2, 3, 4] as const).map((n) => {
              const key = `rules_teaser_${n}` as const
              return (
                <label key={key} className="block space-y-1.5 text-sm">
                  <span className="text-e4-silver">Teaser de regras {n}</span>
                  <Textarea
                    rows={2}
                    value={content[key]}
                    onChange={(e) =>
                      setContent((c) =>
                        c ? { ...c, [key]: e.target.value } : c,
                      )
                    }
                  />
                </label>
              )
            })}
            <Button
              type="submit"
              disabled={savingContent}
              className="bg-e4-gold font-display font-bold uppercase text-e4-black hover:bg-e4-gold-deep hover:text-white"
            >
              {savingContent ? 'Salvando…' : 'Salvar conteúdo'}
            </Button>
          </form>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl text-e4-gold">Stats</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-e4-gold-deep/50"
                onClick={startCreateStat}
              >
                Novo
              </Button>
            </div>

            <ul className="space-y-2">
              {stats.map((stat) => (
                <li key={stat.id}>
                  <button
                    type="button"
                    onClick={() => startEditStat(stat)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition',
                      statForm.id === stat.id
                        ? 'border-e4-gold bg-e4-gold/10 text-e4-gold'
                        : 'border-e4-gold-deep/30 text-e4-white hover:border-e4-gold/50',
                    )}
                  >
                    <span>
                      {stat.display_order}. {stat.label}
                    </span>
                    <span className="font-display text-e4-gold">
                      {stat.value}
                      {stat.suffix}
                    </span>
                  </button>
                </li>
              ))}
              {stats.length === 0 && (
                <li className="text-sm text-e4-silver">Nenhum stat ainda.</li>
              )}
            </ul>

            <form
              onSubmit={(e) => void handleSaveStat(e)}
              className="space-y-3 rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-4"
            >
              <p className="font-display text-sm text-e4-silver">
                {statForm.id ? 'Editar stat' : 'Novo stat'}
              </p>
              <label className="block space-y-1 text-xs text-e4-silver">
                Label
                <Input
                  className="mt-1"
                  value={statForm.label}
                  onChange={(e) =>
                    setStatForm((f) => ({ ...f, label: e.target.value }))
                  }
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block space-y-1 text-xs text-e4-silver">
                  Valor
                  <Input
                    className="mt-1"
                    type="number"
                    value={statForm.value}
                    onChange={(e) =>
                      setStatForm((f) => ({
                        ...f,
                        value: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="block space-y-1 text-xs text-e4-silver">
                  Sufixo
                  <Input
                    className="mt-1"
                    value={statForm.suffix}
                    onChange={(e) =>
                      setStatForm((f) => ({ ...f, suffix: e.target.value }))
                    }
                    placeholder="+"
                  />
                </label>
                <label className="block space-y-1 text-xs text-e4-silver">
                  Ordem
                  <Input
                    className="mt-1"
                    type="number"
                    value={statForm.display_order}
                    onChange={(e) =>
                      setStatForm((f) => ({
                        ...f,
                        display_order: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={savingStat}
                  className="bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white"
                >
                  {savingStat ? 'Salvando…' : statForm.id ? 'Atualizar' : 'Criar'}
                </Button>
                {statForm.id && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleDeleteStat(statForm.id!)}
                  >
                    Excluir
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
