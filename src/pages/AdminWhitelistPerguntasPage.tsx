import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  createWhitelistQuestion,
  deleteWhitelistQuestion,
  fetchWhitelistEmbedSettings,
  fetchWhitelistQuestions,
  updateWhitelistEmbedSettings,
  updateWhitelistQuestion,
} from '@/lib/whitelist'
import type {
  WhitelistEmbedSettings,
  WhitelistQuestion,
} from '@/types/whitelist'

export function AdminWhitelistPerguntasPage() {
  useDocumentTitle('Admin · Whitelist perguntas · Elite Four')
  const [questions, setQuestions] = useState<WhitelistQuestion[]>([])
  const [embed, setEmbed] = useState<WhitelistEmbedSettings | null>(null)
  const [newPrompt, setNewPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [q, e] = await Promise.all([
        fetchWhitelistQuestions(),
        fetchWhitelistEmbedSettings(),
      ])
      setQuestions(q)
      setEmbed(e)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAddQuestion() {
    if (!newPrompt.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createWhitelistQuestion({ prompt: newPrompt })
      setNewPrompt('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar pergunta')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEmbed() {
    if (!embed) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateWhitelistEmbedSettings({
        title: embed.title,
        subtitle: embed.subtitle,
        description: embed.description,
        image_url: embed.image_url || null,
        button_label: embed.button_label,
      })
      setEmbed(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar embed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel-badge text-e4-gold">ADMIN</p>
          <h1 className="mt-1 font-display text-3xl text-e4-white">
            Whitelist · perguntas
          </h1>
          <p className="mt-2 text-sm text-e4-silver">
            Configure as perguntas do formulário Discord e o visual do embed.
            Depois de salvar o embed, use{' '}
            <code className="text-e4-gold">!wl-refresh-embed</code> no canal do
            formulário (admin) para republicar.
          </p>
        </div>
        <div className="flex gap-2">
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
      {saved && (
        <p className="mt-4 rounded-md border border-e4-gold/40 bg-e4-gold/10 px-3 py-2 text-sm text-e4-gold">
          Embed salvo. Rode !wl-refresh-embed no Discord para atualizar a
          mensagem.
        </p>
      )}

      {loading || !embed ? (
        <p className="mt-8 text-e4-silver">Carregando…</p>
      ) : (
        <div className="mt-8 space-y-10">
          <div className="space-y-4">
            <h2 className="font-display text-xl text-e4-gold">Embed Discord</h2>
            <label className="block space-y-2">
              <span className="text-xs font-display uppercase text-e4-silver">
                Título
              </span>
              <Input
                value={embed.title}
                onChange={(e) =>
                  setEmbed({ ...embed, title: e.target.value })
                }
                className="border-e4-gold-deep/40 bg-e4-black"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-display uppercase text-e4-silver">
                Subtítulo
              </span>
              <Input
                value={embed.subtitle}
                onChange={(e) =>
                  setEmbed({ ...embed, subtitle: e.target.value })
                }
                className="border-e4-gold-deep/40 bg-e4-black"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-display uppercase text-e4-silver">
                Descrição
              </span>
              <Textarea
                value={embed.description}
                onChange={(e) =>
                  setEmbed({ ...embed, description: e.target.value })
                }
                rows={5}
                className="border-e4-gold-deep/40 bg-e4-black font-mono text-sm"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-display uppercase text-e4-silver">
                URL da imagem (banner)
              </span>
              <Input
                value={embed.image_url ?? ''}
                onChange={(e) =>
                  setEmbed({ ...embed, image_url: e.target.value || null })
                }
                placeholder="https://..."
                className="border-e4-gold-deep/40 bg-e4-black"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-display uppercase text-e4-silver">
                Texto do botão
              </span>
              <Input
                value={embed.button_label}
                onChange={(e) =>
                  setEmbed({ ...embed, button_label: e.target.value })
                }
                className="border-e4-gold-deep/40 bg-e4-black"
              />
            </label>
            <Button
              disabled={saving}
              className="bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white"
              onClick={() => void handleSaveEmbed()}
            >
              {saving ? 'Salvando…' : 'Salvar embed'}
            </Button>
          </div>

          <div className="space-y-4">
            <h2 className="font-display text-xl text-e4-gold">Perguntas</h2>
            <ul className="space-y-3">
              {questions.map((q, i) => (
                <li
                  key={q.id}
                  className="rounded-lg border border-e4-gold-deep/30 bg-e4-black-soft p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs text-e4-gold">
                      #{i + 1}
                    </span>
                    <label className="flex items-center gap-2 text-xs text-e4-silver">
                      <input
                        type="checkbox"
                        checked={q.active}
                        onChange={(e) => {
                          void updateWhitelistQuestion(q.id, {
                            active: e.target.checked,
                          }).then(load)
                        }}
                      />
                      Ativa
                    </label>
                  </div>
                  <Textarea
                    value={q.prompt}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((x) =>
                          x.id === q.id
                            ? { ...x, prompt: e.target.value }
                            : x,
                        ),
                      )
                    }
                    onBlur={() => {
                      void updateWhitelistQuestion(q.id, {
                        prompt: q.prompt,
                      })
                    }}
                    rows={2}
                    className="mt-2 border-e4-gold-deep/40 bg-e4-black text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-e4-dusk/50 text-e4-dusk"
                      onClick={() => {
                        if (!confirm('Apagar esta pergunta?')) return
                        void deleteWhitelistQuestion(q.id).then(load)
                      }}
                    >
                      Apagar
                    </Button>
                  </div>
                </li>
              ))}
              {questions.length === 0 && (
                <p className="text-sm text-e4-silver">
                  Nenhuma pergunta ainda. Adicione abaixo.
                </p>
              )}
            </ul>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Nova pergunta…"
                className="border-e4-gold-deep/40 bg-e4-black"
              />
              <Button
                disabled={saving || !newPrompt.trim()}
                className="bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white"
                onClick={() => void handleAddQuestion()}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
