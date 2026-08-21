import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { RoleBadge } from '@/components/auth/RoleBadge'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const sections = [
  {
    to: '/admin/conteudo',
    title: 'Conteúdo',
    blurb: 'Hero, teasers e stats da home',
  },
  { to: '/admin/regras', title: 'Regras', blurb: 'Editor markdown por seção' },
  {
    to: '/admin/loja',
    title: 'Loja',
    blurb: 'Catálogo, destaques e tickets Discord',
  },
  {
    to: '/admin/doacoes',
    title: 'Doações',
    blurb: 'Cargos que veem tickets no Discord',
  },
  {
    to: '/admin/depoimentos',
    title: 'Depoimentos',
    blurb: 'Curadoria do carrossel',
  },
  {
    to: '/admin/usuarios',
    title: 'Usuários',
    blurb: 'Perfis e cargos do Discord (read-only)',
  },
  {
    to: '/admin/convites',
    title: 'Convites',
    blurb: 'Keys do beta fechado e quem está vinculado',
  },
  {
    to: '/admin/whitelist/perguntas',
    title: 'WL · Perguntas',
    blurb: 'Perguntas e embed do formulário Discord',
  },
  {
    to: '/admin/whitelist/formularios',
    title: 'WL · Formulários',
    blurb: 'Revisar respostas e aprovar / recusar',
  },
  {
    to: '/admin/whitelist/entrevistas',
    title: 'WL · Entrevistas',
    blurb: 'Fila de entrevista e liberação no servidor',
  },
]

export function AdminPage() {
  useDocumentTitle('Admin · Elite Four')
  const { profile } = useAuth()

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <img src="/e4-logo.png" alt="" className="h-12 w-auto" />
        <div>
          <p className="font-pixel-badge text-e4-gold">PAINEL</p>
          <h1 className="font-display text-3xl text-e4-white">Admin E4</h1>
        </div>
        {profile && <RoleBadge role={profile.role} />}
      </div>
      <p className="mt-4 max-w-2xl text-e4-silver">
        Olá, {profile?.username}. Edite conteúdo, regras, loja e depoimentos
        sem novo deploy. Atalho rápido: ⌘K / Ctrl+K.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="rounded-lg border border-e4-gold-deep/40 bg-e4-black-soft p-4 transition hover:border-e4-gold hover:shadow-[0_0_20px_rgba(242,183,5,0.15)]"
          >
            <h2 className="font-display text-xl text-e4-gold">{s.title}</h2>
            <p className="mt-1 text-sm text-e4-silver">{s.blurb}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
