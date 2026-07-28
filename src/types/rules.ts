export type RulesSection = {
  id: string
  slug: string
  title: string
  body_md: string
  display_order: number
  is_published: boolean
  updated_at: string
}

export type RulesSectionInput = {
  slug: string
  title: string
  body_md: string
  display_order: number
  is_published: boolean
}

export const RULES_FALLBACK: RulesSection[] = [
  {
    id: 'fb-geral',
    slug: 'geral',
    title: 'Geral',
    body_md:
      '## Conduta\n\n- Respeite todos os jogadores e a staff.\n- Toxicidade, bullying e discriminação resultam em punição.',
    display_order: 1,
    is_published: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fb-rp',
    slug: 'rp',
    title: 'RP',
    body_md:
      '## Roleplay\n\n- Mantenha o personagem consistente.\n- Meta-gaming e power-gaming são proibidos.',
    display_order: 2,
    is_published: true,
    updated_at: new Date().toISOString(),
  },
]
