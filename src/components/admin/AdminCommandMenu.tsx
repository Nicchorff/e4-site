import {
  FileText,
  Home,
  MessageSquareQuote,
  Package,
  ScrollText,
  Users,
} from 'lucide-react'
import { CommandMenu } from '@/components/unlumen-ui/command-menu'

const adminGroups = [
  {
    heading: 'Admin',
    items: [
      {
        label: 'Painel',
        href: '/admin',
        icon: Home,
        keywords: ['admin', 'hub'],
      },
      {
        label: 'Conteúdo',
        href: '/admin/conteudo',
        icon: FileText,
        keywords: ['hero', 'stats', 'home'],
      },
      {
        label: 'Regras',
        href: '/admin/regras',
        icon: ScrollText,
        keywords: ['regras', 'markdown'],
      },
      {
        label: 'Loja',
        href: '/admin/loja',
        icon: Package,
        keywords: ['produtos', 'destaques', 'stripe'],
      },
      {
        label: 'Depoimentos',
        href: '/admin/depoimentos',
        icon: MessageSquareQuote,
        keywords: ['testemunhos', 'carrossel'],
      },
      {
        label: 'Usuários',
        href: '/admin/usuarios',
        icon: Users,
        keywords: ['cargos', 'discord', 'profiles'],
      },
    ],
  },
  {
    heading: 'Site',
    items: [
      { label: 'Home pública', href: '/', keywords: ['início'] },
      { label: 'Regras públicas', href: '/regras' },
      { label: 'Loja pública', href: '/loja' },
    ],
  },
]

export function AdminCommandMenu() {
  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <CommandMenu
        groups={adminGroups}
        showThemeGroup={false}
        placeholder="Ir para seção admin…"
        triggerProps={{
          label: 'Admin…',
          shortcut: 'K',
          className:
            'max-w-[11rem] border-e4-gold-deep/50 bg-e4-black-soft text-e4-silver shadow-lg shadow-black/40 hover:bg-e4-black hover:text-e4-gold',
        }}
      />
    </div>
  )
}
