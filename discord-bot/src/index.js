import {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
} from 'discord.js'
import { createClient } from '@supabase/supabase-js'

const token = process.env.DISCORD_BOT_TOKEN
const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const formChannelId =
  process.env.DISCORD_WL_FORM_CHANNEL_ID ?? '1509568568948293773'

if (!token || !supabaseUrl || !serviceKey) {
  console.error(
    'Missing DISCORD_BOT_TOKEN, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
})

/** @type {Map<string, { id: string, discord_id: string, current_question_index: number, last_bot_message_id: string | null }>} */
const activeByThread = new Map()

async function loadActiveApplications() {
  const { data, error } = await supabase
    .from('whitelist_applications')
    .select(
      'id, discord_id, discord_thread_id, current_question_index, last_bot_message_id, status',
    )
    .eq('status', 'in_progress')

  if (error) {
    console.error('loadActiveApplications', error)
    return
  }

  activeByThread.clear()
  for (const row of data ?? []) {
    if (!row.discord_thread_id) continue
    activeByThread.set(row.discord_thread_id, {
      id: row.id,
      discord_id: row.discord_id,
      current_question_index: row.current_question_index ?? 0,
      last_bot_message_id: row.last_bot_message_id,
    })
  }
  console.log(`Loaded ${activeByThread.size} active whitelist threads`)
}

async function loadActiveQuestions() {
  const { data, error } = await supabase
    .from('whitelist_questions')
    .select('id, prompt, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

async function loadEmbedSettings() {
  const { data, error } = await supabase
    .from('whitelist_embed_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) throw error
  return (
    data ?? {
      title: '🔥 Whitelist Elite Four',
      subtitle: '⚡ Formulário automático!',
      description:
        '» Responda as perguntas com sinceridade.\n🚨 • Código do jogo obrigatório (6 dígitos).',
      image_url: null,
      button_label: 'Fazer formulário',
      embed_message_id: null,
    }
  )
}

function buildFormEmbed(settings) {
  const embed = new EmbedBuilder()
    .setTitle(settings.title || '🔥 Whitelist Elite Four')
    .setDescription(
      `**${settings.subtitle || '⚡ Formulário automático!'}**\n\n${
        settings.description || ''
      }`,
    )
    .setColor(0xf2b705)
    .setFooter({ text: 'Elite Four · whitelist' })
    .setTimestamp()

  if (settings.image_url) {
    embed.setImage(settings.image_url)
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('wl_start')
      .setLabel(settings.button_label || 'Fazer formulário')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📝'),
  )

  return { embeds: [embed], components: [row] }
}

async function ensureFormEmbed() {
  const channel = await client.channels.fetch(formChannelId).catch(() => null)
  if (!channel || !channel.isTextBased()) {
    console.error('Form channel not found or not text-based:', formChannelId)
    return
  }

  const settings = await loadEmbedSettings()
  const payload = buildFormEmbed(settings)

  if (settings.embed_message_id) {
    try {
      const existing = await channel.messages.fetch(settings.embed_message_id)
      await existing.edit(payload)
      console.log('Updated whitelist form embed', settings.embed_message_id)
      return
    } catch {
      console.warn('Stored embed message missing; posting a new one')
    }
  }

  const msg = await channel.send(payload)
  await supabase
    .from('whitelist_embed_settings')
    .update({
      embed_message_id: msg.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  console.log('Posted whitelist form embed', msg.id)
}

async function refreshActiveFromDb(threadId) {
  const { data } = await supabase
    .from('whitelist_applications')
    .select(
      'id, discord_id, discord_thread_id, current_question_index, last_bot_message_id, status',
    )
    .eq('discord_thread_id', threadId)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (!data) {
    activeByThread.delete(threadId)
    return null
  }

  const entry = {
    id: data.id,
    discord_id: data.discord_id,
    current_question_index: data.current_question_index ?? 0,
    last_bot_message_id: data.last_bot_message_id,
  }
  activeByThread.set(threadId, entry)
  return entry
}

async function handleAnswer(message) {
  if (!message.channel.isThread()) return
  if (message.author.bot) return

  const threadId = message.channel.id
  let app = activeByThread.get(threadId)
  if (!app) {
    app = await refreshActiveFromDb(threadId)
  }
  if (!app) return

  if (message.author.id !== app.discord_id) {
    await message.delete().catch(() => null)
    return
  }

  const answerText = message.content?.trim()
  if (!answerText) {
    await message.delete().catch(() => null)
    return
  }

  const questions = await loadActiveQuestions()
  if (questions.length === 0) {
    await message.channel.send(
      'Nenhuma pergunta ativa configurada. Avise a staff.',
    )
    return
  }

  const idx = app.current_question_index
  const question = questions[idx]
  if (!question) {
    // Already past end — force pending
    await finishApplication(message.channel, app)
    return
  }

  await supabase.from('whitelist_answers').insert({
    application_id: app.id,
    question_id: question.id,
    question_prompt: question.prompt,
    answer_text: answerText,
  })

  // Delete user answer + last bot question
  const toDelete = [message.id]
  if (app.last_bot_message_id) toDelete.push(app.last_bot_message_id)
  try {
    await message.channel.bulkDelete(toDelete, true)
  } catch {
    for (const id of toDelete) {
      await message.channel.messages.delete(id).catch(() => null)
    }
  }

  const nextIdx = idx + 1
  if (nextIdx >= questions.length) {
    await finishApplication(message.channel, app)
    return
  }

  const next = questions[nextIdx]
  const botMsg = await message.channel.send({
    embeds: [
      {
        title: `Pergunta ${nextIdx + 1}/${questions.length}`,
        description: next.prompt,
        color: 0xf2b705,
        footer: { text: 'Responda nesta thread com uma mensagem.' },
      },
    ],
  })

  await supabase
    .from('whitelist_applications')
    .update({
      current_question_index: nextIdx,
      last_bot_message_id: botMsg.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', app.id)

  activeByThread.set(threadId, {
    ...app,
    current_question_index: nextIdx,
    last_bot_message_id: botMsg.id,
  })
}

async function finishApplication(channel, app) {
  await supabase
    .from('whitelist_applications')
    .update({
      status: 'pending_review',
      current_question_index: app.current_question_index,
      last_bot_message_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', app.id)

  activeByThread.delete(channel.id)

  await channel.send({
    embeds: [
      {
        title: 'Formulário enviado!',
        description:
          'Suas respostas foram enviadas para análise da staff. Aguarde o resultado no canal de resultados.',
        color: 0x3ba55d,
      },
    ],
  })

  try {
    await channel.setArchived(true)
  } catch (err) {
    console.error('archive thread failed', err)
  }
}

// Poll for new in_progress apps created by Edge Function
setInterval(() => {
  void loadActiveApplications()
}, 15_000)

client.once(Events.ClientReady, async (c) => {
  console.log(`Whitelist bot ready as ${c.user.tag}`)
  await loadActiveApplications()
  await ensureFormEmbed()
})

client.on(Events.MessageCreate, (message) => {
  void handleAnswer(message).catch((err) =>
    console.error('handleAnswer error', err),
  )
})

// Allow admin to refresh embed via typing "wl-refresh-embed" in form channel (bot owner only optional)
client.on(Events.MessageCreate, async (message) => {
  if (message.channelId !== formChannelId) return
  if (message.author.bot) return
  if (message.content.trim() !== '!wl-refresh-embed') return

  const member = message.member
  if (!member?.permissions.has('Administrator')) {
    await message.reply('Só administradores podem atualizar o embed.').catch(
      () => null,
    )
    return
  }

  await message.delete().catch(() => null)
  await ensureFormEmbed()
})

client.login(token)
