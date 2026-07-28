import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteTestimonial,
  fetchAllTestimonialsAdmin,
  upsertTestimonial,
} from '@/lib/home-content'
import type { Testimonial } from '@/types/home'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'

const emptyForm = {
  id: undefined as string | undefined,
  author_name: '',
  body: '',
  displayed_at: new Date().toISOString().slice(0, 10),
  display_order: 0,
  is_active: true,
}

export function AdminDepoimentosPage() {
  useDocumentTitle('Admin · Depoimentos · Elite Four')
  const [items, setItems] = useState<Testimonial[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchAllTestimonialsAdmin())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao carregar depoimentos',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const nextOrder = useMemo(() => {
    if (items.length === 0) return 1
    return Math.max(...items.map((t) => t.display_order)) + 1
  }, [items])

  function startCreate() {
    setForm({ ...emptyForm, display_order: nextOrder })
    setError(null)
  }

  function startEdit(t: Testimonial) {
    setForm({
      id: t.id,
      author_name: t.author_name,
      body: t.body,
      displayed_at: t.displayed_at.slice(0, 10),
      display_order: t.display_order,
      is_active: t.is_active,
    })
    setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.author_name.trim() || !form.body.trim()) {
      setError('Autor e texto são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await upsertTestimonial({
        id: form.id,
        author_name: form.author_name,
        body: form.body,
        displayed_at: form.displayed_at,
        display_order: Number(form.display_order) || 0,
        is_active: form.is_active,
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
    if (!window.confirm('Excluir este depoimento?')) return
    setError(null)
    try {
      await deleteTestimonial(id)
      if (form.id === id) startCreate()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    }
  }

  async function toggleActive(t: Testimonial) {
    setError(null)
    try {
      await upsertTestimonial({
        id: t.id,
        author_name: t.author_name,
        body: t.body,
        displayed_at: t.displayed_at.slice(0, 10),
        display_order: t.display_order,
        is_active: !t.is_active,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar')
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel-badge text-e4-gold">ADMIN</p>
          <h1 className="mt-1 font-display text-3xl text-e4-white">
            Depoimentos
          </h1>
          <p className="mt-2 text-sm text-e4-silver">
            Curadoria do carrossel da home. Inativos não aparecem publicamente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-e4-gold-deep text-e4-gold"
            onClick={startCreate}
          >
            Novo
          </Button>
          <Button asChild variant="outline" className="border-e4-gold-deep/50">
            <Link to="/admin">Voltar</Link>
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-e4-dusk/50 bg-e4-dusk/10 px-3 py-2 text-sm text-e4-dusk">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <div className="space-y-2">
          {loading ? (
            <p className="text-e4-silver">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-e4-silver">Nenhum depoimento.</p>
          ) : (
            items.map((t) => (
              <div
                key={t.id}
                className={cn(
                  'rounded-lg border border-e4-gold-deep/35 bg-e4-black-soft p-4',
                  !t.is_active && 'opacity-60',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg text-e4-white">
                      {t.author_name}
                    </p>
                    <p className="text-xs text-e4-silver">
                      {t.displayed_at.slice(0, 10)} · ordem {t.display_order}
                      {t.is_active ? '' : ' · inativo'}
                    </p>
                    <p className="mt-2 text-sm text-e4-silver">{t.body}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-e4-gold-deep/50"
                      onClick={() => startEdit(t)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={
                        t.is_active
                          ? 'bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white'
                          : 'border border-e4-gold-deep/50 text-e4-gold'
                      }
                      onClick={() => void toggleActive(t)}
                    >
                      {t.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => void handleSave(e)}
          className="h-fit space-y-3 rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-4"
        >
          <h2 className="font-display text-xl text-e4-gold">
            {form.id ? 'Editar' : 'Novo depoimento'}
          </h2>
          <label className="block text-xs text-e4-silver">
            Autor
            <Input
              className="mt-1 border-e4-gold-deep/40 bg-e4-black"
              value={form.author_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, author_name: e.target.value }))
              }
            />
          </label>
          <label className="block text-xs text-e4-silver">
            Texto
            <Textarea
              className="mt-1 min-h-24 border-e4-gold-deep/40 bg-e4-black"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-e4-silver">
              Data
              <Input
                type="date"
                className="mt-1 border-e4-gold-deep/40 bg-e4-black"
                value={form.displayed_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayed_at: e.target.value }))
                }
              />
            </label>
            <label className="block text-xs text-e4-silver">
              Ordem
              <Input
                type="number"
                className="mt-1 border-e4-gold-deep/40 bg-e4-black"
                value={form.display_order}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    display_order: Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-e4-white">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_active: e.target.checked }))
              }
              className="size-4 accent-e4-gold"
            />
            Ativo na home
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white"
            >
              {saving ? 'Salvando…' : form.id ? 'Atualizar' : 'Criar'}
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
      </div>
    </section>
  )
}
