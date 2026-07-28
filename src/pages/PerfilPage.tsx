import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/auth/RoleBadge'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function PerfilPage() {
  useDocumentTitle('Perfil · Elite Four')
  const {
    configured,
    loading,
    user,
    profile,
    isAdmin,
    signInWithDiscord,
    signOut,
    refreshProfile,
  } = useAuth()

  if (!configured) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16 text-e4-silver">
        <h1 className="font-display text-3xl text-e4-white">Perfil</h1>
        <p className="mt-3 text-sm">
          Configure o Supabase no arquivo <code className="text-e4-gold">.env</code> para
          habilitar o login Discord.
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-e4-silver">
        Carregando…
      </div>
    )
  }

  if (!user) {
    return (
      <section className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
        <div>
          <p className="font-pixel-badge text-e4-gold">LOGIN</p>
          <h1 className="mt-2 font-display text-3xl text-e4-white">
            Entre com Discord
          </h1>
          <p className="mt-2 text-e4-silver">
            Sem senha. Seu acesso e cargos vêm do servidor Elite Four no Discord.
          </p>
        </div>
        <Button
          size="lg"
          className="bg-[#5865F2] font-display font-bold uppercase tracking-wide text-white hover:bg-[#4752C4]"
          onClick={() => void signInWithDiscord()}
        >
          Entrar com Discord
        </Button>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-6 rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-6 sm:flex-row sm:items-center">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="h-20 w-20 rounded-full border border-e4-gold-deep/50"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-e4-black font-display text-2xl text-e4-gold">
            E4
          </div>
        )}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl text-e4-white sm:text-3xl">
              {profile?.username ?? 'Jogador'}
            </h1>
            {profile && <RoleBadge role={profile.role} />}
          </div>
          <p className="font-mono text-xs text-e4-silver">
            Discord ID: {profile?.discord_id ?? '—'}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          variant="outline"
          className="border-e4-gold-deep text-e4-gold"
          onClick={() => void refreshProfile()}
        >
          Atualizar cargos
        </Button>
        {isAdmin && (
          <Button asChild className="bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white">
            <Link to="/admin">Painel admin</Link>
          </Button>
        )}
        <Button variant="ghost" onClick={() => void signOut()}>
          Sair
        </Button>
      </div>

      {!profile && (
        <p className="mt-6 text-sm text-e4-dusk">
          Perfil ainda não sincronizado. Confira se a Edge Function tem{' '}
          <code className="font-mono">DISCORD_BOT_TOKEN</code>,{' '}
          <code className="font-mono">DISCORD_GUILD_ID</code> e os role IDs.
        </p>
      )}
    </section>
  )
}
