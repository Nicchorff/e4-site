import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DISCORD_CONFIG_FIELDS,
  type DiscordConfigKey,
  fetchDiscordRuntimeConfig,
  isValidSnowflake,
  updateDiscordRuntimeConfig,
} from '@/lib/discord-config'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

type Values = Record<DiscordConfigKey, string>

const emptyValues = Object.fromEntries(
  DISCORD_CONFIG_FIELDS.map((f) => [f.key, '']),
) as Values

const groups = [
  { id: 'roles', title: 'Cargos' },
  { id: 'channels', title: 'Servidor, categorias e canais' },
] as const

export function AdminDiscordPage() {
  useDocumentTitle('Admin · Discord · Elite Four')
  const [values, setValues] = useState<Values>(emptyValues)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cfg = await fetchDiscordRuntimeConfig()
      const next = { ...emptyValues }
      for (const f of DISCORD_CONFIG_FIELDS) next[f.key] = cfg[f.key]
      setValues(next)
      setUpdatedAt(cfg.updated_at)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao carregar configuração',
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
      await updateDiscordRuntimeConfig(values)
      setSaved(true)
      await load()
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
            Discord · cargos e canais
          </h1>
          <p className="mt-2 text-sm text-e4-silver">
            Estes IDs mandam no bot e nas Edge Functions. Os secrets{' '}
            <code className="text-e4-gold">DISCORD_*</code> no Supabase só
            valem quando o campo aqui estiver vazio. Salvar já vale no próximo
            clique no Discord, sem redeploy. Cargos que veem tickets de doação
            ficam em{' '}
            <Link
              to="/admin/doacoes"
              className="text-e4-gold underline-offset-2 hover:underline"
            >
              Doações
            </Link>
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
          Configuração salva.
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-e4-silver">Carregando…</p>
      ) : (
        <form
          className="mt-8 space-y-8"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSave()
          }}
        >
          {groups.map((group) => (
            <fieldset key={group.id} className="space-y-4">
              <legend className="font-display text-sm uppercase text-e4-gold">
                {group.title}
              </legend>
              {DISCORD_CONFIG_FIELDS.filter((f) => f.group === group.id).map(
                (field) => {
                  const value = values[field.key]
                  const invalid = value.trim() !== '' && !isValidSnowflake(value.trim())
                  return (
                    <label key={field.key} className="block space-y-1">
                      <span className="text-sm text-e4-white">
                        {field.label}
                      </span>
                      <Input
                        value={value}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-invalid={invalid || undefined}
                        placeholder="123456789012345678"
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        className="border-e4-gold-deep/40 bg-e4-black font-mono text-sm text-e4-white"
                      />
                      {'hint' in field && (
                        <span className="block text-xs text-e4-silver">
                          {field.hint}
                        </span>
                      )}
                      {invalid && (
                        <span className="block text-xs text-e4-dusk">
                          Use só dígitos (17 a 20).
                        </span>
                      )}
                    </label>
                  )
                },
              )}
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              disabled={saving}
              className="bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
            {updatedAt && (
              <span className="text-xs text-e4-silver">
                Última alteração:{' '}
                {new Date(updatedAt).toLocaleString('pt-BR')}
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
