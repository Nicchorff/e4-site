import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export const DISCORD_CONFIG_FIELDS = [
  { key: 'admin_role_id', label: 'Cargo admin (painel /admin)', group: 'roles' },
  { key: 'staff_role_id', label: 'Cargo staff', group: 'roles' },
  { key: 'interview_role_id', label: 'Cargo entrevista (pós formulário WL)', group: 'roles' },
  { key: 'approved_role_id', label: 'Cargo aprovado (entrevista e beta)', group: 'roles' },
  {
    key: 'pending_role_id',
    label: 'Cargo Sem WL (onboarding)',
    group: 'roles',
    hint: 'Ao dar Aprovado (beta ou entrevista), este cargo é removido do membro.',
  },
  { key: 'guild_id', label: 'Servidor (guild)', group: 'channels' },
  { key: 'category_open_id', label: 'Categoria Ticket | Aberto', group: 'channels' },
  { key: 'category_in_progress_id', label: 'Categoria Ticket | Em andamento', group: 'channels' },
  { key: 'category_finished_id', label: 'Categoria Ticket | Finalizado', group: 'channels' },
  { key: 'wl_form_channel_id', label: 'Canal formulário WL', group: 'channels' },
  { key: 'wl_thread_channel_id', label: 'Canal threads WL', group: 'channels' },
  { key: 'wl_result_form_channel_id', label: 'Canal resultado formulário', group: 'channels' },
  { key: 'wl_result_interview_channel_id', label: 'Canal resultado entrevista', group: 'channels' },
  { key: 'beta_access_category_id', label: 'Categoria acesso beta', group: 'channels' },
  { key: 'beta_access_channel_id', label: 'Canal liberar acesso beta', group: 'channels' },
  { key: 'ticket_panel_channel_id', label: 'Canal painel de tickets', group: 'channels' },
] as const

export type DiscordConfigKey = (typeof DISCORD_CONFIG_FIELDS)[number]['key']

export type DiscordRuntimeConfig = Record<DiscordConfigKey, string> & {
  updated_at: string | null
}

const SNOWFLAKE = /^\d{17,20}$/

const KEYS = DISCORD_CONFIG_FIELDS.map((f) => f.key)

function ensureConfigured() {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
}

export function isValidSnowflake(value: string) {
  return SNOWFLAKE.test(value)
}

export async function fetchDiscordRuntimeConfig(): Promise<DiscordRuntimeConfig> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('discord_runtime_config')
    .select([...KEYS, 'updated_at'].join(', '))
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  const row = (data ?? {}) as unknown as Record<string, string | null>
  const out = { updated_at: row.updated_at ?? null } as DiscordRuntimeConfig
  for (const key of KEYS) out[key] = row[key] ? String(row[key]) : ''
  return out
}

export async function updateDiscordRuntimeConfig(
  values: Record<DiscordConfigKey, string>,
): Promise<void> {
  ensureConfigured()
  const patch: Record<string, string | null> = {}
  for (const key of KEYS) {
    const value = (values[key] ?? '').trim()
    if (value && !isValidSnowflake(value)) {
      const label = DISCORD_CONFIG_FIELDS.find((f) => f.key === key)?.label
      throw new Error(`ID inválido em "${label}": use 17 a 20 dígitos.`)
    }
    patch[key] = value || null
  }
  const { data, error } = await supabase
    .from('discord_runtime_config')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Sem permissão para salvar a configuração')
}
