export type WhitelistStatus =
  | 'in_progress'
  | 'pending_review'
  | 'interview'
  | 'approved'
  | 'rejected_form'
  | 'rejected_interview'

export type WhitelistQuestion = {
  id: string
  prompt: string
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export type WhitelistEmbedSettings = {
  id: number
  title: string
  subtitle: string
  description: string
  image_url: string | null
  button_label: string
  embed_message_id: string | null
  updated_at: string
}

export type WhitelistApplication = {
  id: string
  discord_id: string
  discord_username: string
  discord_avatar_url: string | null
  game_code: string
  status: WhitelistStatus
  discord_thread_id: string | null
  current_question_index: number
  reject_reason: string | null
  reviewed_at: string | null
  interviewed_at: string | null
  created_at: string
  updated_at: string
}

export type WhitelistAnswer = {
  id: string
  application_id: string
  question_id: string | null
  question_prompt: string
  answer_text: string
  answered_at: string
}
