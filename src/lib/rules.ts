import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  RULES_FALLBACK,
  type RulesSection,
  type RulesSectionInput,
} from '@/types/rules'

export async function fetchPublishedRules(): Promise<RulesSection[]> {
  if (!isSupabaseConfigured) return RULES_FALLBACK

  const { data, error } = await supabase
    .from('rules_sections')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('fetchPublishedRules', error)
    return RULES_FALLBACK
  }

  return (data as RulesSection[]) ?? RULES_FALLBACK
}

export async function fetchAllRulesAdmin(): Promise<RulesSection[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('rules_sections')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) {
    console.error('fetchAllRulesAdmin', error)
    throw error
  }

  return (data as RulesSection[]) ?? []
}

export async function upsertRule(
  input: RulesSectionInput & { id?: string },
): Promise<RulesSection> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado')
  }

  const payload = {
    slug: input.slug.trim().toLowerCase(),
    title: input.title.trim(),
    body_md: input.body_md,
    display_order: input.display_order,
    is_published: input.is_published,
    ...(input.id ? { id: input.id } : {}),
  }

  const { data, error } = await supabase
    .from('rules_sections')
    .upsert(payload)
    .select()
    .single()

  if (error) throw error
  return data as RulesSection
}

export async function deleteRule(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado')
  }

  const { error } = await supabase.from('rules_sections').delete().eq('id', id)
  if (error) throw error
}

export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}
