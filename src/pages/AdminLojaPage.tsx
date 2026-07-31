import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  fetchAllProductsAdmin,
  fetchCategoriesAdmin,
  setProductFeatured,
  updateFeaturedBadge,
  upsertProduct,
} from '@/lib/store'
import { uploadProductImage, validateProductImage } from '@/lib/storage'
import type { StoreCategory, StoreProduct } from '@/types/store'
import { formatBrl } from '@/types/store'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'

const emptyForm = {
  id: undefined as string | undefined,
  category_id: '',
  slug: '',
  name: '',
  description: '',
  price_reais: '',
  image_url: '',
  benefits_text: '',
  delivery_json: '{"type":"vip","tier":"bronze"}',
  is_active: true,
  is_featured: false,
}

export function AdminLojaPage() {
  useDocumentTitle('Admin · Loja · Elite Four')
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [badges, setBadges] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageInputKey, setImageInputKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prods, cats] = await Promise.all([
        fetchAllProductsAdmin(),
        fetchCategoriesAdmin(),
      ])
      setProducts(prods)
      setCategories(cats)
      setForm((f) => ({
        ...f,
        category_id: f.category_id || cats[0]?.id || '',
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar loja')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!pendingImage) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(pendingImage)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingImage])

  const catName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]))
    return (id: string) => map.get(id) ?? '—'
  }, [categories])

  function startCreate() {
    setForm({
      ...emptyForm,
      category_id: categories[0]?.id ?? '',
    })
    setPendingImage(null)
    setImageInputKey((k) => k + 1)
    setError(null)
  }

  function startEdit(p: StoreProduct) {
    setForm({
      id: p.id,
      category_id: p.category_id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      price_reais: (p.price_cents / 100).toFixed(2),
      image_url: p.image_url ?? '',
      benefits_text: p.benefits.join('\n'),
      delivery_json: JSON.stringify(p.delivery_payload ?? {}, null, 2),
      is_active: p.is_active,
      is_featured: p.is_featured,
    })
    setPendingImage(null)
    setImageInputKey((k) => k + 1)
    setError(null)
  }

  function onImagePick(file: File | null) {
    if (!file) {
      setPendingImage(null)
      return
    }
    const validationError = validateProductImage(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setPendingImage(file)
  }

  function clearImage() {
    setPendingImage(null)
    setForm((f) => ({ ...f, image_url: '' }))
    setImageInputKey((k) => k + 1)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim() || !form.category_id) {
      setError('Nome, slug e categoria são obrigatórios.')
      return
    }
    const price = Number(form.price_reais.replace(',', '.'))
    if (!Number.isFinite(price) || price < 0) {
      setError('Preço inválido.')
      return
    }
    let delivery_payload: Record<string, unknown> = {}
    try {
      delivery_payload = JSON.parse(form.delivery_json || '{}') as Record<
        string,
        unknown
      >
    } catch {
      setError('delivery_payload precisa ser JSON válido.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      let image_url: string | null = form.image_url || null
      if (pendingImage) {
        image_url = await uploadProductImage(pendingImage)
      }

      const productId = await upsertProduct({
        id: form.id,
        category_id: form.category_id,
        slug: form.slug,
        name: form.name,
        description: form.description,
        price_cents: Math.round(price * 100),
        image_url,
        benefits: form.benefits_text
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        delivery_payload,
        is_active: form.is_active,
        is_featured: form.is_featured,
      })
      await setProductFeatured(
        productId,
        form.is_featured,
        badges[productId]?.trim() || 'DESTAQUE',
      )
      await load()
      startCreate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleFeatured(p: StoreProduct) {
    setError(null)
    try {
      const next = !p.is_featured
      await setProductFeatured(
        p.id,
        next,
        badges[p.id]?.trim() || 'DESTAQUE',
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no destaque')
    }
  }

  async function saveBadge(productId: string) {
    setError(null)
    try {
      await updateFeaturedBadge(productId, badges[productId] ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar badge')
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel-badge text-e4-gold">ADMIN</p>
          <h1 className="mt-1 font-display text-3xl text-e4-white">
            Loja · catálogo
          </h1>
          <p className="mt-2 max-w-xl text-sm text-e4-silver">
            Curadoria de destaques e edição essencial de produtos. Checkout
            atual: ticket Discord (ver{' '}
            <Link to="/admin/doacoes" className="text-e4-gold underline-offset-2 hover:underline">
              Doações
            </Link>
            ). Stripe permanece no código para reativar depois. Doc:{' '}
            <code className="text-e4-gold">docs/discord-donation-tickets.md</code>.
          </p>
        </div>
        <Button asChild variant="outline" className="border-e4-gold-deep/50">
          <Link to="/admin">Voltar</Link>
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-e4-dusk/40 bg-e4-dusk/10 px-3 py-2 text-sm text-e4-dusk">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-e4-silver">Carregando…</p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
          <div className="space-y-3">
            <h2 className="font-display text-xl text-e4-gold">Produtos</h2>
            {products.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'rounded-lg border border-e4-gold-deep/35 bg-e4-black-soft p-4',
                  !p.is_active && 'opacity-60',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg text-e4-white">
                      {p.name}
                    </p>
                    <p className="text-xs text-e4-silver">
                      {catName(p.category_id)} · {p.slug} ·{' '}
                      {formatBrl(p.price_cents)}
                      {p.is_featured ? ' · destaque' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-e4-gold-deep/50"
                      onClick={() => startEdit(p)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={
                        p.is_featured
                          ? 'bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white'
                          : 'bg-e4-black-soft text-e4-gold border border-e4-gold-deep/50'
                      }
                      onClick={() => void toggleFeatured(p)}
                    >
                      {p.is_featured ? 'Remover destaque' : 'Destacar'}
                    </Button>
                  </div>
                </div>
                {p.is_featured && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="min-w-[140px] flex-1">
                      <label className="text-xs text-e4-silver">Badge</label>
                      <Input
                        value={badges[p.id] ?? ''}
                        placeholder="DESTAQUE"
                        onChange={(e) =>
                          setBadges((b) => ({ ...b, [p.id]: e.target.value }))
                        }
                        className="mt-1 border-e4-gold-deep/40 bg-e4-black"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-e4-gold-deep/50"
                      onClick={() => void saveBadge(p.id)}
                    >
                      Salvar badge
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {products.length === 0 && (
              <p className="text-sm text-e4-silver">
                Nenhum produto. Use o formulário ao lado ou o seed da migration.
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => void handleSave(e)}
            className="h-fit space-y-3 rounded-lg border border-e4-gold-deep/35 bg-e4-black-soft p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl text-e4-gold">
                {form.id ? 'Editar' : 'Novo produto'}
              </h2>
              {form.id && (
                <Button type="button" size="sm" variant="ghost" onClick={startCreate}>
                  Limpar
                </Button>
              )}
            </div>

            <label className="block text-xs text-e4-silver">
              Categoria
              <select
                className="mt-1 w-full rounded-md border border-e4-gold-deep/40 bg-e4-black px-3 py-2 text-sm text-e4-white"
                value={form.category_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category_id: e.target.value }))
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-e4-silver">
              Nome
              <Input
                className="mt-1 border-e4-gold-deep/40 bg-e4-black"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </label>

            <label className="block text-xs text-e4-silver">
              Slug
              <Input
                className="mt-1 border-e4-gold-deep/40 bg-e4-black"
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }
              />
            </label>

            <label className="block text-xs text-e4-silver">
              Preço (R$)
              <Input
                className="mt-1 border-e4-gold-deep/40 bg-e4-black"
                value={form.price_reais}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price_reais: e.target.value }))
                }
              />
            </label>

            <label className="block text-xs text-e4-silver">
              Descrição
              <Textarea
                className="mt-1 min-h-20 border-e4-gold-deep/40 bg-e4-black"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </label>

            <label className="block text-xs text-e4-silver">
              Benefícios (1 por linha)
              <Textarea
                className="mt-1 min-h-16 border-e4-gold-deep/40 bg-e4-black"
                value={form.benefits_text}
                onChange={(e) =>
                  setForm((f) => ({ ...f, benefits_text: e.target.value }))
                }
              />
            </label>

            <div className="space-y-2 text-xs text-e4-silver">
              <span className="block">Imagem</span>
              {(previewUrl || form.image_url) && (
                <img
                  src={previewUrl ?? form.image_url}
                  alt="Prévia do produto"
                  className="aspect-video w-full rounded-md border border-e4-gold-deep/40 object-cover"
                />
              )}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-e4-gold-deep/50 bg-e4-black px-3 py-4 text-center transition-colors hover:border-e4-gold hover:bg-e4-black/80">
                <span className="text-sm text-e4-gold">Anexar imagem</span>
                <span className="text-[11px] text-e4-silver/80">
                  JPEG, PNG, WebP ou GIF · máx. 5MB
                </span>
                <input
                  key={imageInputKey}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) =>
                    onImagePick(e.target.files?.[0] ?? null)
                  }
                />
              </label>
              {pendingImage && (
                <p className="truncate text-[11px] text-e4-gold">
                  {pendingImage.name}
                </p>
              )}
              {(pendingImage || form.image_url) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="px-0 text-e4-dusk hover:text-e4-dusk"
                  onClick={clearImage}
                >
                  Remover
                </Button>
              )}
            </div>

            <label className="block text-xs text-e4-silver">
              delivery_payload (JSON)
              <Textarea
                className="mt-1 min-h-24 font-mono text-xs border-e4-gold-deep/40 bg-e4-black"
                value={form.delivery_json}
                onChange={(e) =>
                  setForm((f) => ({ ...f, delivery_json: e.target.value }))
                }
              />
            </label>

            <div className="flex flex-wrap gap-4 text-sm text-e4-silver">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_active: e.target.checked }))
                  }
                />
                Ativo
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_featured: e.target.checked }))
                  }
                />
                Destaque
              </label>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white"
            >
              {saving ? 'Salvando…' : form.id ? 'Atualizar' : 'Criar'}
            </Button>
          </form>
        </div>
      )}
    </section>
  )
}
