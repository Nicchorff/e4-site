export type SiteStat = {
  id: string
  label: string
  value: number
  suffix: string
  display_order: number
}

export type Testimonial = {
  id: string
  author_name: string
  body: string
  displayed_at: string
  display_order: number
  is_active: boolean
}

export type HomeContent = {
  heroHeadline: string
  heroSubtitle: string
  rulesTeasers: string[]
  stats: SiteStat[]
  testimonials: Testimonial[]
}

export const HOME_FALLBACK: HomeContent = {
  heroHeadline: 'RP Pokémon no FiveM, do jeito elite.',
  heroSubtitle:
    'Entre no servidor, vive o roleplay e fortaleça seu time na Elite Four.',
  rulesTeasers: [
    'Respeite todos os jogadores — toxicidade e bullying não têm lugar aqui.',
    'Mantenha o RP: meta-gaming e power-gaming quebram a imersão.',
    'Proibido RDM/VDM e ações sem justificativa de personagem.',
    'Compras da loja são digitais e seguem as regras de entrega in-game.',
  ],
  stats: [
    {
      id: 'fb-1',
      label: 'Membros no Discord',
      value: 1200,
      suffix: '+',
      display_order: 1,
    },
    {
      id: 'fb-2',
      label: 'Jogadores na cidade',
      value: 85,
      suffix: '',
      display_order: 2,
    },
    {
      id: 'fb-3',
      label: 'Itens na loja',
      value: 40,
      suffix: '+',
      display_order: 3,
    },
  ],
  testimonials: [
    {
      id: 'fb-t1',
      author_name: 'Luna',
      body: 'Melhor servidor de Pokémon RP que já joguei. A vibe GBA é demais.',
      displayed_at: '2026-06-12',
      display_order: 1,
      is_active: true,
    },
    {
      id: 'fb-t2',
      author_name: 'Rafa',
      body: 'Staff atenciosa e a loja entrega rápido. Recomendo o VIP.',
      displayed_at: '2026-06-28',
      display_order: 2,
      is_active: true,
    },
    {
      id: 'fb-t3',
      author_name: 'Kai',
      body: 'A comunidade é acolhedora — entrei pelo Discord e fiquei.',
      displayed_at: '2026-07-05',
      display_order: 3,
      is_active: true,
    },
    {
      id: 'fb-t4',
      author_name: 'Mika',
      body: 'Captura, RP e eventos: tudo encaixa. E4 virou minha casa.',
      displayed_at: '2026-07-18',
      display_order: 4,
      is_active: true,
    },
  ],
}
