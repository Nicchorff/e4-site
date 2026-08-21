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
import {
  botInviteUrl,
  ensureGuildSetup,
  loadDotEnv,
  persistRuntimeConfig,
  printEnvBlock,
  registerSlashCommand,
} from './setup-guild.js'

loadDotEnv()

const token = process.env.DISCORD_BOT_TOKEN
const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
let formChannelId = process.env.DISCORD_WL_FORM_CHANNEL_ID || ''
let betaAccessChannelId = process.env.DISCORD_BETA_ACCESS_CHANNEL_ID || ''
let ticketPanelChannelId = process.env.DISCORD_TICKET_PANEL_CHANNEL_ID || ''

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
  if (!formChannelId) return
  try {
    const channel = await client.channels.fetch(formChannelId).catch((err) => {
      console.error(
        'Cannot fetch form channel',
        formChannelId,
        err?.message ?? err,
      )
      return null
    })
    if (!channel || !channel.isTextBased()) {
      console.error(
        'Form channel missing or inaccessible. Give the bot Ver canal + Enviar mensagens on',
        formChannelId,
      )
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
  } catch (err) {
    console.error(
      'ensureFormEmbed failed (bot stays online). Fix channel perms for',
      formChannelId,
      '→',
      err?.message ?? err,
    )
  }
}

function buildBetaEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🔴 Liberar acesso beta')
    .setDescription(
      '**Beta fechado Elite Four**\n\n' +
        'Você precisa de uma **key** gerada pela staff.\n' +
        'No jogo, copie o código de **6 dígitos** e informe os dois campos.\n\n' +
        'Se a key não existir ou já tiver sido usada, o acesso **não** é liberado.',
    )
    .setColor(0xed4245)
    .setFooter({ text: 'Elite Four · beta fechado' })
    .setTimestamp()

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('beta_redeem_start')
      .setLabel('Liberar acesso')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔑'),
  )

  return { embeds: [embed], components: [row] }
}

function buildTicketPanelEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('Tickets Elite Four')
    .setDescription(
      '**Dúvida, suporte ou reporte**\n\n' +
        'Escolha o tipo e descreva o assunto. Um canal privado é criado nas categorias Ticket.\n' +
        'A staff assume o ticket e encerra quando o atendimento terminar.\n\n' +
        'Só um ticket aberto por vez.',
    )
    .setColor(0xf2b705)
    .setFooter({ text: 'Elite Four · tickets' })
    .setTimestamp()

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_start:duvida')
      .setLabel('Dúvida')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❓'),
    new ButtonBuilder()
      .setCustomId('ticket_start:suporte')
      .setLabel('Suporte')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔧'),
    new ButtonBuilder()
      .setCustomId('ticket_start:reporte')
      .setLabel('Reporte')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚨'),
  )

  return { embeds: [embed], components: [row] }
}

async function loadTicketPanelEmbedMessageId() {
  const { data } = await supabase
    .from('discord_runtime_config')
    .select('ticket_panel_embed_message_id')
    .eq('id', 1)
    .maybeSingle()
  return data?.ticket_panel_embed_message_id || null
}

async function ensureTicketPanelEmbed() {
  if (!ticketPanelChannelId) return
  try {
    const channel = await client.channels.fetch(ticketPanelChannelId).catch((err) => {
      console.error(
        'Cannot fetch ticket panel channel',
        ticketPanelChannelId,
        err?.message ?? err,
      )
      return null
    })
    if (!channel || !channel.isTextBased()) {
      console.error(
        'Ticket panel channel missing or inaccessible',
        ticketPanelChannelId,
      )
      return
    }

    const payload = buildTicketPanelEmbed()
    const existingId = await loadTicketPanelEmbedMessageId()
    if (existingId) {
      try {
        const existing = await channel.messages.fetch(existingId)
        await existing.edit(payload)
        console.log('Updated ticket panel embed', existingId)
        return
      } catch {
        console.warn('Stored ticket panel embed missing; posting a new one')
      }
    }

    const msg = await channel.send(payload)
    await supabase
      .from('discord_runtime_config')
      .update({
        ticket_panel_embed_message_id: msg.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    console.log('Posted ticket panel embed', msg.id)
  } catch (err) {
    console.error(
      'ensureTicketPanelEmbed failed',
      ticketPanelChannelId,
      err?.message ?? err,
    )
  }
}

async function loadBetaEmbedMessageId() {
  const { data } = await supabase
    .from('discord_runtime_config')
    .select('beta_embed_message_id')
    .eq('id', 1)
    .maybeSingle()
  return data?.beta_embed_message_id || null
}

async function ensureBetaEmbed() {
  if (!betaAccessChannelId) return
  try {
    const channel = await client.channels.fetch(betaAccessChannelId).catch((err) => {
      console.error(
        'Cannot fetch beta access channel',
        betaAccessChannelId,
        err?.message ?? err,
      )
      return null
    })
    if (!channel || !channel.isTextBased()) {
      console.error(
        'Beta access channel missing or inaccessible',
        betaAccessChannelId,
      )
      return
    }

    const payload = buildBetaEmbed()
    const existingId = await loadBetaEmbedMessageId()
    if (existingId) {
      try {
        const existing = await channel.messages.fetch(existingId)
        await existing.edit(payload)
        console.log('Updated beta access embed', existingId)
        return
      } catch {
        console.warn('Stored beta embed missing; posting a new one')
      }
    }

    const msg = await channel.send(payload)
    await supabase
      .from('discord_runtime_config')
      .update({
        beta_embed_message_id: msg.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    console.log('Posted beta access embed', msg.id)
  } catch (err) {
    console.error(
      'ensureBetaEmbed failed',
      betaAccessChannelId,
      err?.message ?? err,
    )
  }
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
  if (message.author.bot) return
  if (!message.guild) return

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

  // Delete user answer + last bot question (skip forum starter msg = thread id)
  const toDelete = [message.id]
  if (app.last_bot_message_id && app.last_bot_message_id !== threadId) {
    toDelete.push(app.last_bot_message_id)
  }
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
    if (channel.isThread?.() || typeof channel.setArchived === 'function') {
      await channel.setArchived(true)
    }
  } catch (err) {
    console.error('archive channel/thread failed', err)
  }
}

// Poll for new in_progress apps created by Edge Function
setInterval(() => {
  void loadActiveApplications()
}, 15_000)

client.once(Events.ClientReady, async (c) => {
  console.log(`Whitelist bot ready as ${c.user.tag}`)
  const guildId =
    process.env.DISCORD_GUILD_ID || c.guilds.cache.first()?.id || ''
  if (!guildId) {
    console.error(
      `Bot is in no guild. Invite it, then restart:\n${botInviteUrl(c.user.id)}`,
    )
  } else {
    try {
      const ids = await ensureGuildSetup({
        rest: c.rest,
        guildId,
        botUserId: c.user.id,
      })
      formChannelId = ids.formChannelId || formChannelId
      betaAccessChannelId = ids.betaAccessChannelId || betaAccessChannelId
      ticketPanelChannelId = ids.ticketPanelChannelId || ticketPanelChannelId
      if (ids.formChannelId) {
        process.env.DISCORD_WL_FORM_CHANNEL_ID = ids.formChannelId
      }
      if (ids.threadChannelId) {
        process.env.DISCORD_WL_THREAD_CHANNEL_ID = ids.threadChannelId
      }
      if (ids.betaAccessChannelId) {
        process.env.DISCORD_BETA_ACCESS_CHANNEL_ID = ids.betaAccessChannelId
      }
      if (ids.ticketPanelChannelId) {
        process.env.DISCORD_TICKET_PANEL_CHANNEL_ID = ids.ticketPanelChannelId
      }
      process.env.DISCORD_GUILD_ID = guildId
      printEnvBlock(ids)
      await persistRuntimeConfig(supabase, ids)
      await registerSlashCommand(c.rest, c.user.id, guildId)
    } catch (err) {
      console.error('Guild setup failed', err?.message ?? err)
    }
  }
  await loadActiveApplications()
  if (formChannelId) {
    await ensureFormEmbed()
  } else {
    console.error(
      'No whitelist form channel. Move the E4 bot role to the top, then restart or type !e4-setup.',
    )
  }
  if (betaAccessChannelId) {
    await ensureBetaEmbed()
  } else {
    console.warn(
      'No beta access channel. Set DISCORD_BETA_ACCESS_CATEGORY_ID or run !e4-setup.',
    )
  }
  if (ticketPanelChannelId) {
    await ensureTicketPanelEmbed()
  } else {
    console.warn(
      'No ticket panel channel. Restart the bot or run !e4-setup.',
    )
  }
})

client.on(Events.MessageCreate, (message) => {
  void handleAnswer(message).catch((err) =>
    console.error('handleAnswer error', err),
  )
})

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return
  const cmd = message.content.trim()
  if (cmd !== '!wl-refresh-embed' && cmd !== '!e4-setup') return

  const member = message.member
  if (!member?.permissions.has('Administrator')) {
    await message.reply('Só administradores podem usar este comando.').catch(
      () => null,
    )
    return
  }

  if (cmd === '!e4-setup') {
    const guildId = message.guild?.id || process.env.DISCORD_GUILD_ID
    if (!guildId || !client.user) {
      await message.reply('Bot sem guild.').catch(() => null)
      return
    }
    await message.delete().catch(() => null)
    try {
      const ids = await ensureGuildSetup({
        rest: client.rest,
        guildId,
        botUserId: client.user.id,
      })
      formChannelId = ids.formChannelId
      betaAccessChannelId = ids.betaAccessChannelId || betaAccessChannelId
      ticketPanelChannelId = ids.ticketPanelChannelId || ticketPanelChannelId
      printEnvBlock(ids)
      await persistRuntimeConfig(supabase, ids)
      await registerSlashCommand(client.rest, client.user.id, guildId)
      if (ids.formChannelId) {
        formChannelId = ids.formChannelId
        await ensureFormEmbed()
      }
      if (ids.betaAccessChannelId) {
        betaAccessChannelId = ids.betaAccessChannelId
        await ensureBetaEmbed()
      }
      if (ids.ticketPanelChannelId) {
        ticketPanelChannelId = ids.ticketPanelChannelId
        await ensureTicketPanelEmbed()
      }
      await message.channel.send(
        `Setup ok. Form: ${ids.formChannelId ? `<#${ids.formChannelId}>` : 'n/a'} · Tickets: ${ids.ticketPanelChannelId ? `<#${ids.ticketPanelChannelId}>` : 'n/a'} · Beta: ${ids.betaAccessChannelId ? `<#${ids.betaAccessChannelId}>` : 'n/a'} · invite: ${ids.inviteUrl || 'n/a'}`,
      )
    } catch (err) {
      await message.channel.send(`Setup falhou: ${err?.message ?? err}`)
    }
    return
  }

  if (message.channelId !== formChannelId) return
  await message.delete().catch(() => null)
  await ensureFormEmbed()
})

client.login(token)
