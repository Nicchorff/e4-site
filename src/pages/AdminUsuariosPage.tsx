import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RoleBadge } from '@/components/auth/RoleBadge'
import { fetchProfilesAdmin, filterProfiles } from '@/lib/profiles'
import type { AppRole, Profile } from '@/types/profile'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'

const ROLE_FILTERS: Array<AppRole | 'all'> = [
  'all',
  'admin',
  'staff',
  'member',
]

export function AdminUsuariosPage() {
  useDocumentTitle('Admin · Usuários · Elite Four')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [role, setRole] = useState<AppRole | 'all'>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProfiles(await fetchProfilesAdmin())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () => filterProfiles(profiles, { role, query }),
    [profiles, role, query],
  )

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel-badge text-e4-gold">ADMIN</p>
          <h1 className="mt-1 font-display text-3xl text-e4-white">Usuários</h1>
          <p className="mt-2 max-w-xl text-sm text-e4-silver">
            Visualização read-only dos perfis. Cargos vêm do Discord via{' '}
            <code className="text-e4-gold">sync-discord-roles</code> — não
            edite aqui.
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
        <p className="mt-4 rounded-md border border-e4-dusk/50 bg-e4-dusk/10 px-3 py-2 text-sm text-e4-dusk">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar username ou Discord ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm border-e4-gold-deep/40 bg-e4-black-soft"
        />
        <div className="flex flex-wrap gap-1">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-display uppercase tracking-wide transition',
                role === r
                  ? 'border-e4-gold bg-e4-gold/15 text-e4-gold'
                  : 'border-e4-gold-deep/30 text-e4-silver hover:border-e4-gold/40',
              )}
            >
              {r === 'all' ? 'Todos' : r}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-e4-silver">
        {filtered.length} de {profiles.length} perfil(is)
      </p>

      {loading ? (
        <p className="mt-6 text-e4-silver">Carregando…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-e4-gold-deep/35">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-e4-black-soft text-e4-silver">
              <tr>
                <th className="px-3 py-2 font-display font-semibold">User</th>
                <th className="px-3 py-2 font-display font-semibold">
                  Discord ID
                </th>
                <th className="px-3 py-2 font-display font-semibold">Cargo</th>
                <th className="px-3 py-2 font-display font-semibold">
                  Atualizado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-e4-gold-deep/25 text-e4-white"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="size-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-8 items-center justify-center rounded-full bg-e4-gold/20 text-xs text-e4-gold">
                          {p.username.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="font-display">{p.username}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-e4-silver">
                    {p.discord_id}
                  </td>
                  <td className="px-3 py-2">
                    <RoleBadge role={p.role} />
                  </td>
                  <td className="px-3 py-2 text-xs text-e4-silver">
                    {new Date(p.updated_at).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-center text-e4-silver"
                  >
                    Nenhum perfil neste filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
