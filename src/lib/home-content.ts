import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  HOME_FALLBACK,
  type HomeContent,
  type SiteStat,
  type Testimonial,
} from '@/types/home'

function mapContent(rows: { key: string; value: string }[] | null): {
  heroHeadline: string
  heroSubtitle: string
  rulesTeasers: string[]
} {
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]))
  const teasers = [1, 2, 3, 4]
    .map((n) => map.get(`rules_teaser_${n}`))
    .filter((v): v is string => Boolean(v))

  return {
    heroHeadline: map.get('hero_headline') ?? HOME_FALLBACK.heroHeadline,
    heroSubtitle: map.get('hero_subtitle') ?? HOME_FALLBACK.heroSubtitle,
    rulesTeasers:
      teasers.length > 0 ? teasers : HOME_FALLBACK.rulesTeasers,
  }
}

export async function fetchHomeContent(): Promise<HomeContent> {
  if (!isSupabaseConfigured) return HOME_FALLBACK

  try {
    const [contentRes, statsRes, testimonialsRes] = await Promise.all([
      supabase.from('site_content').select('key, value'),
      supabase
        .from('site_stats')
        .select('*')
        .order('display_order', { ascending: true }),
      supabase
        .from('testimonials')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
    ])

    if (contentRes.error || statsRes.error || testimonialsRes.error) {
      console.error('fetchHomeContent errors', {
        content: contentRes.error,
        stats: statsRes.error,
        testimonials: testimonialsRes.error,
      })
      return HOME_FALLBACK
    }

    const mapped = mapContent(contentRes.data)
    const stats = (statsRes.data as SiteStat[] | null) ?? []
    const testimonials =
      (testimonialsRes.data as Testimonial[] | null) ?? []

    return {
      ...mapped,
      stats: stats.length > 0 ? stats : HOME_FALLBACK.stats,
      testimonials:
        testimonials.length > 0
          ? testimonials
          : HOME_FALLBACK.testimonials,
    }
  } catch (err) {
    console.error('fetchHomeContent failed', err)
    return HOME_FALLBACK
  }
}

export function getDiscordInviteUrl() {
  return (
    (import.meta.env.VITE_DISCORD_INVITE_URL as string | undefined) ||
    'https://discord.gg/'
  )
}

export const SITE_CONTENT_KEYS = [
  'hero_headline',
  'hero_subtitle',
  'rules_teaser_1',
  'rules_teaser_2',
  'rules_teaser_3',
  'rules_teaser_4',
] as const

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number]

export type SiteContentMap = Record<SiteContentKey, string>

export async function fetchSiteContentAdmin(): Promise<SiteContentMap> {
  if (!isSupabaseConfigured) {
    return {
      hero_headline: HOME_FALLBACK.heroHeadline,
      hero_subtitle: HOME_FALLBACK.heroSubtitle,
      rules_teaser_1: HOME_FALLBACK.rulesTeasers[0] ?? '',
      rules_teaser_2: HOME_FALLBACK.rulesTeasers[1] ?? '',
      rules_teaser_3: HOME_FALLBACK.rulesTeasers[2] ?? '',
      rules_teaser_4: HOME_FALLBACK.rulesTeasers[3] ?? '',
    }
  }
  const { data, error } = await supabase
    .from('site_content')
    .select('key, value')
  if (error) throw error
  const map = new Map((data ?? []).map((r) => [r.key, r.value]))
  return {
    hero_headline: map.get('hero_headline') ?? HOME_FALLBACK.heroHeadline,
    hero_subtitle: map.get('hero_subtitle') ?? HOME_FALLBACK.heroSubtitle,
    rules_teaser_1:
      map.get('rules_teaser_1') ?? HOME_FALLBACK.rulesTeasers[0] ?? '',
    rules_teaser_2:
      map.get('rules_teaser_2') ?? HOME_FALLBACK.rulesTeasers[1] ?? '',
    rules_teaser_3:
      map.get('rules_teaser_3') ?? HOME_FALLBACK.rulesTeasers[2] ?? '',
    rules_teaser_4:
      map.get('rules_teaser_4') ?? HOME_FALLBACK.rulesTeasers[3] ?? '',
  }
}

export async function upsertSiteContent(entries: Partial<SiteContentMap>) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  const rows = Object.entries(entries)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    }))
  if (rows.length === 0) return
  const { error } = await supabase.from('site_content').upsert(rows)
  if (error) throw error
}

export async function fetchAllStatsAdmin(): Promise<SiteStat[]> {
  if (!isSupabaseConfigured) return HOME_FALLBACK.stats
  const { data, error } = await supabase
    .from('site_stats')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data as SiteStat[]) ?? []
}

export type StatWriteInput = {
  id?: string
  label: string
  value: number
  suffix: string
  display_order: number
}

export async function upsertStat(input: StatWriteInput) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  const row = {
    label: input.label.trim(),
    value: Math.round(input.value),
    suffix: input.suffix,
    display_order: input.display_order,
  }
  if (input.id) {
    const { error } = await supabase
      .from('site_stats')
      .update(row)
      .eq('id', input.id)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('site_stats').insert(row)
  if (error) throw error
}

export async function deleteStat(id: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  const { error } = await supabase.from('site_stats').delete().eq('id', id)
  if (error) throw error
}

export async function fetchAllTestimonialsAdmin(): Promise<Testimonial[]> {
  if (!isSupabaseConfigured) return HOME_FALLBACK.testimonials
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data as Testimonial[]) ?? []
}

export type TestimonialWriteInput = {
  id?: string
  author_name: string
  body: string
  displayed_at: string
  display_order: number
  is_active: boolean
}

export async function upsertTestimonial(input: TestimonialWriteInput) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  const row = {
    author_name: input.author_name.trim(),
    body: input.body.trim(),
    displayed_at: input.displayed_at,
    display_order: input.display_order,
    is_active: input.is_active,
  }
  if (input.id) {
    const { error } = await supabase
      .from('testimonials')
      .update(row)
      .eq('id', input.id)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('testimonials').insert(row)
  if (error) throw error
}

export async function deleteTestimonial(id: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  const { error } = await supabase.from('testimonials').delete().eq('id', id)
  if (error) throw error
}
