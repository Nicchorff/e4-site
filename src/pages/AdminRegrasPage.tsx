import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RulesMarkdown } from '@/components/rules/RulesMarkdown'
import {
  deleteRule,
  fetchAllRulesAdmin,
  slugifyTitle,
  upsertRule,
} from '@/lib/rules'
import type { RulesSection } from '@/types/rules'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'

const emptyForm = {
  id: undefined as string | undefined,
  title: '',
  slug: '',
  body_md: '',
  display_order: 0,
  is_published: true,
}

export function AdminRegrasPage() {
  useDocumentTitle('Admin · Regras · Elite Four')
  const [sections, setSections] = useState<RulesSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [slugTouched, setSlugTouched] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllRulesAdmin()
      setSections(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar regras')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const nextOrder = useMemo(() => {
    if (sections.length === 0) return 1
    return Math.max(...sections.map((s) => s.display_order)) + 1
  }, [sections])

  function startCreate() {
    setSlugTouched(false)
    setForm({ ...emptyForm, display_order: nextOrder })
    setError(null)
  }

  function startEdit(section: RulesSection) {
    setSlugTouched(true)
    setForm({
      id: section.id,
      title: section.title,
      slug: section.slug,
      body_md: section.body_md,
      display_order: section.display_order,
      is_published: section.is_published,
    })
    setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.slug.trim() || !form.body_md.trim()) {
      setError('Título, slug e conteúdo são obrigatórios.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await upsertRule({
        id: form.id,
        title: form.title,
        slug: form.slug,
        body_md: form.body_md,
        display_order: Number(form.display_order) || 0,
        is_published: form.is_published,
      })
      await load()
      startCreate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Excluir esta seção de regras?')) return
    setError(null)
    try {
      await deleteRule(id)
      if (form.id === id) startCreate()
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
            Editor de regras
          </h1>
          <p className="mt-2 text-sm text-e4-silver">
            Alterações publicadas aparecem em{' '}
            <Link to="/regras" className="text-e4-gold hover:underline">
              /regras
            </Link>{' '}
            sem novo deploy.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-e4-gold-deep text-e4-gold"
          onClick={startCreate}
        >
          Nova seção
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-e4-dusk/50 bg-e4-dusk/10 px-3 py-2 text-sm text-e4-dusk">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-2">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-e4-silver">
            Seções
          </p>
          {loading ? (
            <p className="text-sm text-e4-silver">Carregando…</p>
          ) : sections.length === 0 ? (
            <p className="text-sm text-e4-silver">Nenhuma seção ainda.</p>
          ) : (
            <ul className="space-y-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => startEdit(section)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition',
                      form.id === section.id
                        ? 'border-e4-gold bg-e4-gold/10 text-e4-gold'
                        : 'border-e4-gold-deep/30 text-e4-white hover:border-e4-gold/50',
                    )}
                  >
                    <span className="font-display font-semibold">
                      {section.display_order}. {section.title}
                    </span>
                    {!section.is_published && (
                      <span className="font-pixel-badge text-[0.5rem] text-e4-dusk">
                        RASCUNHO
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="space-y-6">
          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="text-e4-silver">Título</span>
                <Input
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value
                    setForm((f) => ({
                      ...f,
                      title,
                      slug: slugTouched ? f.slug : slugifyTitle(title),
                    }))
                  }}
                  placeholder="Ex: Geral"
                  required
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-e4-silver">Slug</span>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }}
                  placeholder="geral"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="text-e4-silver">Ordem</span>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      display_order: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-e4-white">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      is_published: e.target.checked,
                    }))
                  }
                  className="size-4 accent-e4-gold"
                />
                Publicado (visível em /regras)
              </label>
            </div>

            <label className="block space-y-1.5 text-sm">
              <span className="text-e4-silver">Conteúdo (Markdown)</span>
              <Textarea
                value={form.body_md}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body_md: e.target.value }))
                }
                rows={14}
                className="min-h-56 font-mono text-sm"
                placeholder={"## Título\n\n- Item da regra"}
                required
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-e4-gold font-display font-bold uppercase text-e4-black hover:bg-e4-gold-deep hover:text-white"
              >
                {saving ? 'Salvando…' : form.id ? 'Atualizar' : 'Criar seção'}
              </Button>
              {form.id && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleDelete(form.id!)}
                >
                  Excluir
                </Button>
              )}
            </div>
          </form>

          <div className="rounded-lg border border-e4-gold-deep/30 bg-e4-black p-5">
            <p className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-e4-silver">
              Preview
            </p>
            {form.body_md.trim() ? (
              <>
                <h2 className="mb-3 font-display text-xl text-e4-gold">
                  {form.title || 'Sem título'}
                </h2>
                <RulesMarkdown content={form.body_md} />
              </>
            ) : (
              <p className="text-sm text-e4-silver">
                Digite markdown para ver o preview.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
