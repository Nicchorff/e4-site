import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type {
  WhitelistAnswer,
  WhitelistApplication,
  WhitelistEmbedSettings,
  WhitelistQuestion,
  WhitelistStatus,
} from '@/types/whitelist'

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado')
  }
}

export async function fetchWhitelistQuestions(): Promise<WhitelistQuestion[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('whitelist_questions')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as WhitelistQuestion[]
}

export async function createWhitelistQuestion(input: {
  prompt: string
  sort_order?: number
  active?: boolean
}): Promise<WhitelistQuestion> {
  ensureConfigured()
  const { data: maxRow } = await supabase
    .from('whitelist_questions')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order =
    input.sort_order ?? ((maxRow?.sort_order as number | undefined) ?? -1) + 1

  const { data, error } = await supabase
    .from('whitelist_questions')
    .insert({
      prompt: input.prompt.trim(),
      sort_order,
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) throw error
  return data as WhitelistQuestion
}

export async function updateWhitelistQuestion(
  id: string,
  patch: Partial<Pick<WhitelistQuestion, 'prompt' | 'sort_order' | 'active'>>,
): Promise<void> {
  ensureConfigured()
  const { error } = await supabase
    .from('whitelist_questions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function deleteWhitelistQuestion(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase
    .from('whitelist_questions')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function fetchWhitelistEmbedSettings(): Promise<WhitelistEmbedSettings> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('whitelist_embed_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('Configuração de embed não encontrada')
  }
  return data as WhitelistEmbedSettings
}

export async function updateWhitelistEmbedSettings(
  patch: Partial<
    Pick<
      WhitelistEmbedSettings,
      'title' | 'subtitle' | 'description' | 'image_url' | 'button_label'
    >
  >,
): Promise<WhitelistEmbedSettings> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('whitelist_embed_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('*')
    .single()

  if (error) throw error
  return data as WhitelistEmbedSettings
}

export async function fetchWhitelistApplications(
  statuses: WhitelistStatus[],
): Promise<WhitelistApplication[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('whitelist_applications')
    .select('*')
    .in('status', statuses)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as WhitelistApplication[]
}

export async function fetchWhitelistAnswers(
  applicationId: string,
): Promise<WhitelistAnswer[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('whitelist_answers')
    .select('*')
    .eq('application_id', applicationId)
    .order('answered_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as WhitelistAnswer[]
}

export type ModerateAction =
  | 'approve_form'
  | 'reject_form'
  | 'approve_interview'
  | 'reject_interview'

export async function moderateWhitelist(input: {
  action: ModerateAction
  applicationId: string
  reason?: string
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  ensureConfigured()
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean
    status?: string
    error?: string
  }>('whitelist-moderate', {
    method: 'POST',
    body: input,
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return { ok: true, status: data?.status }
}
