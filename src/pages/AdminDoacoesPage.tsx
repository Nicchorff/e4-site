import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  fetchDonationTicketSettings,
  updateDonationTicketSettings,
} from '@/lib/store'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function AdminDoacoesPage() {
  useDocumentTitle('Admin · Doações · Elite Four')
  const [rolesText, setRolesText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const settings = await fetchDonationTicketSettings()
      setRolesText(settings.viewer_role_ids.join('\n'))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao carregar configurações',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const ids = rolesText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      await updateDonationTicketSettings(ids)
      setSaved(true)
      setRolesText(ids.join('\n'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel-badge text-e4-gold">ADMIN</p>
          <h1 className="mt-1 font-display text-3xl text-e4-white">
            Doações · tickets Discord
          </h1>
          <p className="mt-2 text-sm text-e4-silver">
            Cargos que sempre veem as 3 categorias Ticket e todos os canais
            (doação, dúvida, suporte e reporte). Quem abre o ticket só vê o
            próprio canal enquanto estiver aberto. Setup:{' '}
            <code className="text-e4-gold">docs/discord-tickets.md</code>
            .
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
      {saved && (
        <p className="mt-4 rounded-md border border-e4-gold/40 bg-e4-gold/10 px-3 py-2 text-sm text-e4-gold">
          Cargos salvos.
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-e4-silver">Carregando…</p>
      ) : (
        <div className="mt-8 space-y-4">
          <label className="block space-y-2">
            <span className="font-display text-sm uppercase text-e4-gold">
              Discord role IDs (viewer)
            </span>
            <Textarea
              value={rolesText}
              onChange={(e) => setRolesText(e.target.value)}
              rows={6}
              placeholder={"123456789012345678\n987654321098765432"}
              className="border-e4-gold-deep/40 bg-e4-black font-mono text-sm text-e4-white"
            />
            <span className="block text-xs text-e4-silver">
              Um ID por linha. Esses cargos + Admin/Staff dos secrets sempre
              veem Ticket | Aberto / Em andamento / Finalizado e todos os
              tickets (doação e suporte). Membros comuns não veem a categoria
              sem um ticket próprio aberto.
            </span>
          </label>
          <Button
            disabled={saving}
            className="bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white"
            onClick={() => void handleSave()}
          >
            {saving ? 'Salvando…' : 'Salvar cargos'}
          </Button>
        </div>
      )}
    </section>
  )
}
