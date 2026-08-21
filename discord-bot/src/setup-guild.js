import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ChannelType,
  PermissionFlagsBits,
  REST,
  Routes,
} from 'discord.js'
import { createClient } from '@supabase/supabase-js'

export const BOT_PERMISSIONS = (
  PermissionFlagsBits.CreateInstantInvite |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ManageMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.ManageThreads |
  PermissionFlagsBits.CreatePrivateThreads |
  PermissionFlagsBits.SendMessagesInThreads
).toString()

const ROLE_SPECS = [
  { key: 'adminRoleId', name: 'Admin', color: 0xf2b705, hoist: true },
  { key: 'staffRoleId', name: 'Staff', color: 0x5865f2, hoist: true },
  { key: 'interviewRoleId', name: 'Entrevista', color: 0xe67e22, hoist: true },
  { key: 'approvedRoleId', name: 'Aprovado', color: 0x3ba55d, hoist: true },
]

const TICKET_CATEGORIES = [
  { key: 'categoryOpenId', name: 'Ticket | Aberto' },
  { key: 'categoryInProgressId', name: 'Ticket | Em andamento' },
  { key: 'categoryFinishedId', name: 'Ticket | Finalizado' },
]

const WL_CHANNELS = [
  { key: 'formChannelId', name: 'whitelist-formulario' },
  { key: 'threadChannelId', name: 'whitelist-threads' },
  { key: 'resultFormChannelId', name: 'resultado-formulario' },
  { key: 'resultInterviewChannelId', name: 'resultado-entrevista' },
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function denyViewEveryone(guildId) {
  return {
    id: guildId,
    type: 0,
    allow: '0',
    deny: PermissionFlagsBits.ViewChannel.toString(),
  }
}

function allowViewRole(roleId) {
  return {
    id: roleId,
    type: 0,
    allow: PermissionFlagsBits.ViewChannel.toString(),
    deny: '0',
  }
}

function allowViewMember(userId) {
  return {
    id: userId,
    type: 1,
    allow: PermissionFlagsBits.ViewChannel.toString(),
    deny: '0',
  }
}

export function botInviteUrl(clientId) {
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${BOT_PERMISSIONS}&scope=bot`
}

export function loadDotEnv() {
  const dir = dirname(fileURLToPath(import.meta.url))
  const path = resolve(dir, '../.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 1) continue
    const key = trimmed.slice(0, i).trim()
    let value = trimmed.slice(i + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function findByName(list, name) {
  const target = name.toLowerCase()
  return list.find((item) => String(item.name ?? '').toLowerCase() === target)
}

/**
 * @param {{ rest: import('discord.js').REST, guildId: string, botUserId: string }} opts
 */
export async function ensureGuildSetup({ rest, guildId, botUserId }) {
  const roles = /** @type {Array<{ id: string, name: string }>} */ (
    await rest.get(Routes.guildRoles(guildId))
  )
  const ids = {
    guildId,
    adminRoleId: '',
    staffRoleId: '',
    interviewRoleId: '',
    approvedRoleId: '',
    categoryOpenId: '',
    categoryInProgressId: '',
    categoryFinishedId: '',
    formChannelId: '',
    threadChannelId: '',
    resultFormChannelId: '',
    resultInterviewChannelId: '',
    inviteUrl: '',
  }

  for (const spec of ROLE_SPECS) {
    const existing = findByName(roles, spec.name)
    if (existing) {
      ids[spec.key] = existing.id
      continue
    }
    const created = /** @type {{ id: string }} */ (
      await rest.post(Routes.guildRoles(guildId), {
        body: {
          name: spec.name,
          color: spec.color,
          hoist: spec.hoist,
          mentionable: false,
        },
      })
    )
    ids[spec.key] = created.id
    roles.push({ id: created.id, name: spec.name })
    console.log(`Created role ${spec.name} ${created.id}`)
    await sleep(350)
  }

  const staffRoleIds = [ids.adminRoleId, ids.staffRoleId].filter(Boolean)
  const ticketOverwrites = [
    denyViewEveryone(guildId),
    allowViewMember(botUserId),
    ...staffRoleIds.map(allowViewRole),
  ]

  let channels = /** @type {Array<{ id: string, name: string, type: number, parent_id?: string | null }>} */ (
    await rest.get(Routes.guildChannels(guildId))
  )

  for (const spec of TICKET_CATEGORIES) {
    const existing = channels.find(
      (ch) =>
        ch.type === ChannelType.GuildCategory &&
        String(ch.name).toLowerCase() === spec.name.toLowerCase(),
    )
    if (existing) {
      ids[spec.key] = existing.id
      await rest.put(`/channels/${existing.id}/permissions/${guildId}`, {
        body: denyViewEveryone(guildId),
      })
      await rest.put(`/channels/${existing.id}/permissions/${botUserId}`, {
        body: allowViewMember(botUserId),
      })
      for (const roleId of staffRoleIds) {
        await rest.put(`/channels/${existing.id}/permissions/${roleId}`, {
          body: allowViewRole(roleId),
        })
      }
      await sleep(250)
      continue
    }
    const created = /** @type {{ id: string, name: string, type: number }} */ (
      await rest.post(Routes.guildChannels(guildId), {
        body: {
          name: spec.name,
          type: ChannelType.GuildCategory,
          permission_overwrites: ticketOverwrites,
        },
      })
    )
    ids[spec.key] = created.id
    channels.push(created)
    console.log(`Created category ${spec.name} ${created.id}`)
    await sleep(350)
  }

  let wlCategory = channels.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      String(ch.name).toLowerCase() === 'whitelist',
  )
  if (!wlCategory) {
    wlCategory = /** @type {{ id: string, name: string, type: number }} */ (
      await rest.post(Routes.guildChannels(guildId), {
        body: {
          name: 'Whitelist',
          type: ChannelType.GuildCategory,
        },
      })
    )
    channels.push(wlCategory)
    console.log(`Created category Whitelist ${wlCategory.id}`)
    await sleep(350)
  }

  for (const spec of WL_CHANNELS) {
    const existing = channels.find(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        String(ch.name).toLowerCase() === spec.name,
    )
    if (existing) {
      ids[spec.key] = existing.id
      continue
    }
    const created = /** @type {{ id: string, name: string, type: number }} */ (
      await rest.post(Routes.guildChannels(guildId), {
        body: {
          name: spec.name,
          type: ChannelType.GuildText,
          parent_id: wlCategory.id,
        },
      })
    )
    ids[spec.key] = created.id
    channels.push(created)
    console.log(`Created channel #${spec.name} ${created.id}`)
    await sleep(350)
  }

  try {
    const invite = /** @type {{ code: string }} */ (
      await rest.post(`/channels/${ids.formChannelId}/invites`, {
        body: { max_age: 0, max_uses: 0, unique: false },
      })
    )
    ids.inviteUrl = `https://discord.gg/${invite.code}`
  } catch (err) {
    console.warn('Could not create community invite:', err?.message ?? err)
  }

  return ids
}

export async function registerSlashCommand(rest, applicationId, guildId) {
  const existing = /** @type {Array<{ name: string }>} */ (
    await rest.get(Routes.applicationGuildCommands(applicationId, guildId))
  )
  if (existing.some((c) => c.name === 'comprovante-aprovado')) {
    console.log('Slash /comprovante-aprovado already registered')
    return
  }
  await rest.post(Routes.applicationGuildCommands(applicationId, guildId), {
    body: {
      name: 'comprovante-aprovado',
      description:
        'Marca o ticket deste canal como pago e enfileira a entrega',
      type: 1,
    },
  })
  console.log('Registered slash /comprovante-aprovado')
}

export async function persistRuntimeConfig(supabase, ids) {
  if (!supabase) return
  const { error } = await supabase.from('discord_runtime_config').upsert({
    id: 1,
    guild_id: ids.guildId,
    admin_role_id: ids.adminRoleId,
    staff_role_id: ids.staffRoleId,
    category_open_id: ids.categoryOpenId,
    category_in_progress_id: ids.categoryInProgressId,
    category_finished_id: ids.categoryFinishedId,
    wl_form_channel_id: ids.formChannelId,
    wl_thread_channel_id: ids.threadChannelId,
    wl_result_form_channel_id: ids.resultFormChannelId,
    wl_result_interview_channel_id: ids.resultInterviewChannelId,
    interview_role_id: ids.interviewRoleId,
    approved_role_id: ids.approvedRoleId,
    invite_url: ids.inviteUrl || null,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.error('persistRuntimeConfig', error.message)
    return
  }
  const viewer = [ids.adminRoleId, ids.staffRoleId].filter(Boolean)
  const { error: viewerErr } = await supabase
    .from('donation_ticket_settings')
    .upsert({ id: 1, viewer_role_ids: viewer })
  if (viewerErr) {
    console.error('donation_ticket_settings', viewerErr.message)
  } else {
    console.log('Saved Discord IDs to discord_runtime_config')
  }
}

export function printEnvBlock(ids) {
  const lines = [
    `DISCORD_GUILD_ID=${ids.guildId}`,
    `DISCORD_ADMIN_ROLE_ID=${ids.adminRoleId}`,
    `DISCORD_STAFF_ROLE_ID=${ids.staffRoleId}`,
    `DISCORD_CATEGORY_OPEN_ID=${ids.categoryOpenId}`,
    `DISCORD_CATEGORY_IN_PROGRESS_ID=${ids.categoryInProgressId}`,
    `DISCORD_CATEGORY_FINISHED_ID=${ids.categoryFinishedId}`,
    `DISCORD_WL_FORM_CHANNEL_ID=${ids.formChannelId}`,
    `DISCORD_WL_THREAD_CHANNEL_ID=${ids.threadChannelId}`,
    `DISCORD_WL_RESULT_FORM_CHANNEL_ID=${ids.resultFormChannelId}`,
    `DISCORD_WL_RESULT_INTERVIEW_CHANNEL_ID=${ids.resultInterviewChannelId}`,
    `DISCORD_WL_INTERVIEW_ROLE_ID=${ids.interviewRoleId}`,
    `DISCORD_WL_APPROVED_ROLE_ID=${ids.approvedRoleId}`,
    ids.inviteUrl ? `VITE_DISCORD_INVITE_URL=${ids.inviteUrl}` : '',
  ].filter(Boolean)
  console.log('\n--- copy to EasyPanel / Supabase secrets ---\n')
  console.log(lines.join('\n'))
  console.log('\n--- end ---\n')
}

async function main() {
  loadDotEnv()
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) {
    console.error('Set DISCORD_BOT_TOKEN (Developer Portal → Bot → Copy)')
    process.exit(1)
  }

  const rest = new REST({ version: '10' }).setToken(token)
  const me = /** @type {{ id: string, username: string }} */ (
    await rest.get('/users/@me')
  )
  console.log(`Bot ${me.username} (${me.id})`)
  console.log(`Invite URL:\n${botInviteUrl(me.id)}\n`)

  let guildId = process.env.DISCORD_GUILD_ID
  if (!guildId) {
    const guilds = /** @type {Array<{ id: string, name: string }>} */ (
      await rest.get('/users/@me/guilds')
    )
    if (guilds.length === 1) {
      guildId = guilds[0].id
      console.log(`Using only guild: ${guilds[0].name} ${guildId}`)
    } else if (guilds.length === 0) {
      console.error(
        'Bot is in no server. Open the invite URL above, pick the NEW guild, then re-run.',
      )
      process.exit(1)
    } else {
      console.error(
        'Bot is in multiple servers. Set DISCORD_GUILD_ID to the new one:',
      )
      for (const g of guilds) console.error(`  ${g.name}  ${g.id}`)
      process.exit(1)
    }
  }

  const ids = await ensureGuildSetup({ rest, guildId, botUserId: me.id })
  await registerSlashCommand(rest, me.id, guildId)
  printEnvBlock(ids)

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey)
    await persistRuntimeConfig(supabase, ids)
  } else {
    console.warn(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — skipped DB persist',
    )
  }
}

const isCli = /setup-guild\.js$/i.test(process.argv[1] || '')

if (isCli) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
