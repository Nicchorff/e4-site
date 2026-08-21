import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import { loadDiscordRuntimeConfig, withCeoAdminRole } from "../_shared/discord-config.ts";
import { panelConfigured, panelLiberateWhitelist } from "../_shared/e4-panel.ts";
import {
  finishPrivateTicketChannel,
  isSupportTicketKind,
  moveTicketChannel,
  postChannelMessageWithRetry,
  privateTicketOverwrites,
  sanitizeChannelPart,
  SUPPORT_KIND_LABEL,
  uniqueIds,
  type SupportTicketKind,
} from "../_shared/discord-tickets.ts";

function hexToUint8Array(hex: string) {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex");
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

function verifyDiscordRequest(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
) {
  const message = new TextEncoder().encode(timestamp + body);
  const sig = hexToUint8Array(signature);
  const key = hexToUint8Array(publicKey);
  return nacl.sign.detached.verify(message, sig, key);
}

async function discordApi(
  token: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: string }).message)
        : text || res.statusText;
    throw new Error(`Discord ${method} ${path}: ${msg}`);
  }
  return data as Record<string, unknown>;
}

function interactionJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function discordAvatarUrl(userId: string, avatar: string | null | undefined) {
  if (!avatar) {
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) % 6n)}.png`;
  }
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=128`;
}

type InteractionUser = {
  id: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
};

type InteractionMember = {
  user?: InteractionUser;
  roles?: string[];
  nick?: string | null;
};

type Interaction = {
  type: number;
  id?: string;
  token?: string;
  application_id?: string;
  guild_id?: string;
  channel_id?: string;
  member?: InteractionMember;
  user?: InteractionUser;
  data?: {
    name?: string;
    custom_id?: string;
    components?: Array<{
      type?: number;
      components?: Array<{
        custom_id?: string;
        value?: string;
      }>;
    }>;
  };
};

async function editOriginalInteraction(
  applicationId: string,
  token: string,
  content: string,
) {
  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.error("editOriginalInteraction failed", res.status, text);
  }
}

async function loadViewerRoleIds(
  admin: ReturnType<typeof createClient>,
): Promise<string[]> {
  const { data } = await admin
    .from("donation_ticket_settings")
    .select("viewer_role_ids")
    .eq("id", 1)
    .maybeSingle();
  return (data?.viewer_role_ids ?? []) as string[];
}

function memberMayModerate(
  member: InteractionMember | undefined,
  viewerRoleIds: string[],
  adminRoleId: string | undefined,
  staffRoleId: string | undefined,
) {
  const roles = member?.roles ?? [];
  if (adminRoleId && roles.includes(adminRoleId)) return true;
  if (staffRoleId && roles.includes(staffRoleId)) return true;
  return viewerRoleIds.some((id) => roles.includes(id));
}

type SupportTicketRow = {
  id: string;
  kind: SupportTicketKind;
  status: string;
  discord_user_id: string;
  discord_username: string;
  discord_channel_id: string;
  claimed_by_discord_id: string | null;
  claimed_at: string | null;
};

async function startSupportTicket(opts: {
  admin: ReturnType<typeof createClient>;
  botToken: string;
  botUserId: string;
  guildId: string;
  categoryOpenId: string;
  adminRoleId: string;
  staffRoleId: string;
  viewerRoleIds: string[];
  member: InteractionMember | undefined;
  kind: SupportTicketKind;
  subject: string;
  body: string;
}): Promise<{ ok: true; channelId: string } | { ok: false; error: string }> {
  const user = opts.member?.user;
  if (!user?.id) {
    return { ok: false, error: "Não foi possível identificar seu Discord." };
  }
  if (!opts.guildId || !opts.categoryOpenId) {
    return { ok: false, error: "Configuração incompleta (categoria Ticket | Aberto)." };
  }

  const subject = opts.subject.trim();
  const body = opts.body.trim();
  if (subject.length < 3) {
    return { ok: false, error: "Informe um assunto com pelo menos 3 caracteres." };
  }

  const { data: active } = await opts.admin
    .from("support_tickets")
    .select("id, discord_channel_id")
    .eq("discord_user_id", user.id)
    .in("status", ["open", "in_progress"])
    .maybeSingle();

  if (active?.discord_channel_id) {
    return {
      ok: false,
      error: `Você já tem um ticket aberto em <#${active.discord_channel_id}>. Aguarde o encerramento.`,
    };
  }

  const { data: profile } = await opts.admin
    .from("profiles")
    .select("id")
    .eq("discord_id", user.id)
    .maybeSingle();

  const displayName =
    opts.member?.nick || user.global_name || user.username || user.id;
  const ticketId = crypto.randomUUID();
  const shortId = ticketId.replace(/-/g, "").slice(0, 8);
  const channelName =
    `${opts.kind}-${sanitizeChannelPart(displayName)}-${shortId}`.slice(0, 100);
  const kindLabel = SUPPORT_KIND_LABEL[opts.kind];

  let botUserId = opts.botUserId;
  if (!botUserId) {
    const botMe = await discordApi(opts.botToken, "GET", "/users/@me");
    botUserId = String(botMe.id);
  }
  const staffRoleIds = uniqueIds(opts.viewerRoleIds, [
    opts.adminRoleId,
    opts.staffRoleId,
  ]);

  let channel: Record<string, unknown>;
  try {
    channel = await discordApi(
      opts.botToken,
      "POST",
      `/guilds/${opts.guildId}/channels`,
      {
        name: channelName,
        type: 0,
        parent_id: opts.categoryOpenId,
        topic: `${kindLabel} E4 · ${subject}`.slice(0, 1024),
        permission_overwrites: privateTicketOverwrites({
          guildId: opts.guildId,
          botUserId,
          memberDiscordId: user.id,
          staffRoleIds,
        }),
      },
    );
  } catch (err) {
    console.error("create support ticket channel", err);
    return {
      ok: false,
      error: `Falha ao criar canal: ${
        err instanceof Error ? err.message : "erro"
      }`,
    };
  }

  const channelId = String(channel.id);
  const embed = {
    title: `Novo ticket · ${kindLabel}`,
    color: 0xf2b705,
    description: "Em alguns instantes alguém vai te atender neste canal.",
    fields: [
      {
        name: "Aberto por",
        value: `<@${user.id}> (\`${displayName}\`)`,
        inline: false,
      },
      { name: "Assunto", value: subject.slice(0, 1024), inline: false },
      {
        name: "Descrição",
        value: (body || "—").slice(0, 1024),
        inline: false,
      },
    ],
    footer: { text: "Elite Four · ticket" },
    timestamp: new Date().toISOString(),
  };

  const posted = await postChannelMessageWithRetry(opts.botToken, channelId, {
    content: `<@${user.id}>`,
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: "Assumir",
            custom_id: `ticket_claim:${ticketId}`,
          },
          {
            type: 2,
            style: 4,
            label: "Encerrar",
            custom_id: `ticket_close:${ticketId}`,
          },
        ],
      },
    ],
  });

  if (!posted.ok) {
    try {
      await discordApi(opts.botToken, "DELETE", `/channels/${channelId}`);
    } catch (cleanupErr) {
      console.error("Failed to delete orphan support channel", cleanupErr);
    }
    return {
      ok: false,
      error: "Canal criado, mas o bot não conseguiu enviar a mensagem inicial.",
    };
  }

  const { error: insertErr } = await opts.admin.from("support_tickets").insert({
    id: ticketId,
    kind: opts.kind,
    status: "open",
    discord_user_id: user.id,
    discord_username: displayName,
    user_id: profile?.id ?? null,
    subject,
    body,
    discord_channel_id: channelId,
    discord_message_id: posted.messageId,
  });

  if (insertErr) {
    console.error("support_tickets insert failed", insertErr);
    try {
      await discordApi(opts.botToken, "DELETE", `/channels/${channelId}`);
    } catch (cleanupErr) {
      console.error("Failed to delete support channel after insert error", cleanupErr);
    }
    if (insertErr.code === "23505") {
      return {
        ok: false,
        error: "Você já tem um ticket aberto. Aguarde o encerramento.",
      };
    }
    return { ok: false, error: insertErr.message };
  }

  return { ok: true, channelId };
}

async function claimSupportTicket(opts: {
  admin: ReturnType<typeof createClient>;
  botToken: string;
  channelId: string;
  categoryInProgress: string;
  actorId: string | undefined;
  ticketId: string;
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const { data: ticket } = await opts.admin
    .from("support_tickets")
    .select("*")
    .eq("id", opts.ticketId)
    .maybeSingle();

  if (!ticket) return { ok: false, error: "Ticket não encontrado no banco." };
  if (ticket.status === "finished") {
    return { ok: false, error: "Este ticket já foi finalizado." };
  }
  if (ticket.status === "in_progress" && ticket.claimed_by_discord_id) {
    return {
      ok: false,
      error: `Já assumido por <@${ticket.claimed_by_discord_id}>.`,
    };
  }

  try {
    await moveTicketChannel(
      opts.botToken,
      opts.channelId,
      opts.categoryInProgress,
    );
  } catch (err) {
    return {
      ok: false,
      error: `Falha ao mover canal: ${
        err instanceof Error ? err.message : "erro"
      }`,
    };
  }

  await opts.admin
    .from("support_tickets")
    .update({
      status: "in_progress",
      claimed_by_discord_id: opts.actorId ?? null,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", ticket.id);

  return {
    ok: true,
    content: `<@${opts.actorId}> assumiu este ticket. Canal movido para **Ticket | Em andamento**.`,
  };
}

async function closeSupportTicket(opts: {
  admin: ReturnType<typeof createClient>;
  botToken: string;
  categoryFinished?: string;
  actorId: string | undefined;
  ticket: SupportTicketRow;
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  if (opts.ticket.status === "finished") {
    return { ok: false, error: "Ticket já finalizado." };
  }

  await finishPrivateTicketChannel({
    token: opts.botToken,
    channelId: opts.ticket.discord_channel_id,
    categoryFinishedId: opts.categoryFinished,
    openerDiscordId: opts.ticket.discord_user_id,
  });

  const now = new Date().toISOString();
  await opts.admin
    .from("support_tickets")
    .update({
      status: "finished",
      finished_at: now,
      finished_by_discord_id: opts.actorId ?? null,
      claimed_by_discord_id:
        opts.ticket.claimed_by_discord_id ?? opts.actorId ?? null,
      claimed_at: opts.ticket.claimed_at ?? now,
    })
    .eq("id", opts.ticket.id);

  return {
    ok: true,
    content: `<@${opts.actorId}> encerrou este ticket. Canal movido para **Ticket | Finalizado**.`,
  };
}

async function markTicketPaid(
  admin: ReturnType<typeof createClient>,
  orderId: string,
) {
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, status, order_items(id)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false as const, error: "Pedido não encontrado" };
  if (order.status === "paid") {
    return { ok: true as const, already: true };
  }

  await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  const { data: profile } = await admin
    .from("profiles")
    .select("discord_id")
    .eq("id", order.user_id)
    .maybeSingle();

  const discordId = profile?.discord_id ?? "unknown";
  const items = (order.order_items ?? []) as { id: string }[];

  if (items.length > 0) {
    await admin.from("deliveries").insert(
      items.map((item) => ({
        order_item_id: item.id,
        player_discord_id: discordId,
        status: "pending",
        attempts: 0,
      })),
    );
  }

  return { ok: true as const, already: false };
}

function normalizeBetaKey(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

async function redeemBetaInvite(opts: {
  admin: ReturnType<typeof createClient>;
  botToken: string;
  guildId: string;
  approvedRoleId: string;
  member: InteractionMember | undefined;
  keyCode: string;
  gameCode: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const keyCode = normalizeBetaKey(opts.keyCode);
  const gameCode = opts.gameCode.trim();
  const user = opts.member?.user;

  if (!user?.id) {
    return { ok: false, error: "Não foi possível identificar seu Discord." };
  }
  if (!keyCode) {
    return { ok: false, error: "Informe a key do beta." };
  }
  if (!/^\d{6}$/.test(gameCode)) {
    return { ok: false, error: "Código do jogo inválido. Use exatamente 6 dígitos." };
  }
  if (!panelConfigured()) {
    return {
      ok: false,
      error: "Liberação do servidor indisponível. Avise a staff.",
    };
  }

  const { data: key, error: keyErr } = await opts.admin
    .from("beta_invite_keys")
    .select("id, status")
    .eq("code", keyCode)
    .maybeSingle();

  if (keyErr) {
    console.error("beta key lookup", keyErr);
    return { ok: false, error: "Falha ao consultar a key." };
  }
  if (!key || key.status !== "unused") {
    return { ok: false, error: "Key inválida ou já utilizada." };
  }

  const { data: existingDiscord } = await opts.admin
    .from("beta_invite_keys")
    .select("id")
    .eq("status", "redeemed")
    .eq("redeemed_discord_id", user.id)
    .maybeSingle();
  if (existingDiscord) {
    return { ok: false, error: "Você já vinculou uma key neste Discord." };
  }

  const { data: existingCode } = await opts.admin
    .from("beta_invite_keys")
    .select("id")
    .eq("status", "redeemed")
    .eq("game_code", gameCode)
    .maybeSingle();
  if (existingCode) {
    return {
      ok: false,
      error: "Este código do jogo já está vinculado a outra key.",
    };
  }

  const displayName =
    opts.member?.nick || user.global_name || user.username || user.id;
  const avatarUrl = discordAvatarUrl(user.id, user.avatar);
  const now = new Date().toISOString();

  const { data: claimed, error: claimErr } = await opts.admin
    .from("beta_invite_keys")
    .update({
      status: "redeemed",
      redeemed_at: now,
      redeemed_discord_id: user.id,
      redeemed_discord_username: displayName,
      redeemed_discord_avatar_url: avatarUrl,
      game_code: gameCode,
    })
    .eq("id", key.id)
    .eq("status", "unused")
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed) {
    return { ok: false, error: "Key inválida ou já utilizada." };
  }

  const liberated = await panelLiberateWhitelist(gameCode);
  if (!liberated.ok) {
    await opts.admin
      .from("beta_invite_keys")
      .update({
        status: "unused",
        redeemed_at: null,
        redeemed_discord_id: null,
        redeemed_discord_username: null,
        redeemed_discord_avatar_url: null,
        game_code: null,
      })
      .eq("id", key.id);

    if (liberated.error === "code_not_found") {
      return {
        ok: false,
        error:
          "Código do jogo não encontrado. Entre no servidor uma vez para gerar o código e tente de novo.",
      };
    }
    return {
      ok: false,
      error: "Não foi possível liberar no servidor. Tente mais tarde.",
    };
  }

  await opts.admin
    .from("beta_invite_keys")
    .update({
      fivem_account_id: liberated.account.id,
      fivem_license: liberated.account.license,
      fivem_discord: liberated.account.discord,
    })
    .eq("id", key.id);

  if (opts.approvedRoleId && opts.guildId) {
    try {
      await discordApi(
        opts.botToken,
        "PUT",
        `/guilds/${opts.guildId}/members/${user.id}/roles/${opts.approvedRoleId}`,
      );
    } catch (err) {
      console.error("add approved role failed", err);
    }
  }

  return { ok: true };
}

const BLOCKING_STATUSES = [
  "in_progress",
  "pending_review",
  "interview",
  "approved",
];

async function startWhitelistApplication(opts: {
  admin: ReturnType<typeof createClient>;
  botToken: string;
  guildId: string;
  threadParentChannelId: string;
  member: InteractionMember | undefined;
  gameCode: string;
  adminRoleId: string;
  staffRoleId: string;
}) {
  const {
    admin,
    botToken,
    guildId,
    threadParentChannelId,
    member,
    gameCode,
    adminRoleId,
    staffRoleId,
  } = opts;

  const user = member?.user;
  if (!user?.id) {
    return { ok: false as const, error: "Usuário Discord não encontrado." };
  }

  if (!/^\d{6}$/.test(gameCode)) {
    return {
      ok: false as const,
      error: "Código inválido. Use exatamente 6 dígitos.",
    };
  }

  const { data: existing } = await admin
    .from("whitelist_applications")
    .select("id, status")
    .eq("discord_id", user.id)
    .in("status", BLOCKING_STATUSES)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      ok: false as const,
      error:
        existing.status === "approved"
          ? "Você já está aprovado na whitelist."
          : "Você já tem um formulário em andamento.",
    };
  }

  const { data: questions, error: qErr } = await admin
    .from("whitelist_questions")
    .select("id, prompt, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (qErr) {
    return { ok: false as const, error: qErr.message };
  }
  if (!questions || questions.length === 0) {
    return {
      ok: false as const,
      error: "Nenhuma pergunta configurada. Avise a staff.",
    };
  }

  const displayName =
    member?.nick || user.global_name || user.username || user.id;
  const avatarUrl = discordAvatarUrl(user.id, user.avatar);
  const channelName = `wl-${displayName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || `wl-${user.id.slice(-6)}`;

  let parentChannel: Record<string, unknown>;
  try {
    parentChannel = await discordApi(
      botToken,
      "GET",
      `/channels/${threadParentChannelId}`,
    );
  } catch (err) {
    return {
      ok: false as const,
      error: `Canal/categoria de whitelist inacessível: ${
        err instanceof Error ? err.message : "erro"
      }`,
    };
  }

  const parentType = Number(parentChannel.type);
  // 0 text, 4 category, 5 announcement, 15 forum, 16 media
  const isCategory = parentType === 4;
  const isForum = parentType === 15 || parentType === 16;
  const isTextLike = parentType === 0 || parentType === 5;

  if (!isCategory && !isForum && !isTextLike) {
    return {
      ok: false as const,
      error:
        `Destino de whitelist inválido (tipo ${parentType}). Use categoria, canal de texto ou fórum.`,
    };
  }

  const first = questions[0];
  const firstEmbed = {
    title: `Pergunta 1/${questions.length}`,
    description: first.prompt,
    color: 0xf2b705,
    footer: { text: "Responda neste canal com uma mensagem." },
  };

  const VIEW_CHANNEL = 1 << 10;
  const SEND_MESSAGES = 1 << 11;
  const EMBED_LINKS = 1 << 14;
  const ATTACH_FILES = 1 << 15;
  const READ_MESSAGE_HISTORY = 1 << 16;
  const MANAGE_MESSAGES = 1 << 13;
  const USER_ALLOW =
    VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY | ATTACH_FILES;
  const BOT_ALLOW =
    VIEW_CHANNEL |
    SEND_MESSAGES |
    READ_MESSAGE_HISTORY |
    EMBED_LINKS |
    ATTACH_FILES |
    MANAGE_MESSAGES;

  let ticketChannel: Record<string, unknown>;
  let botMsgId: string | null = null;

  try {
    if (isCategory) {
      if (!guildId) {
        return {
          ok: false as const,
          error: "DISCORD_GUILD_ID não configurado no servidor.",
        };
      }
      const botMe = await discordApi(botToken, "GET", "/users/@me");
      const botUserId = String(botMe.id);

      const permission_overwrites: {
        id: string;
        type: 0 | 1;
        allow: string;
        deny: string;
      }[] = [
        {
          id: guildId,
          type: 0,
          allow: "0",
          deny: String(VIEW_CHANNEL),
        },
        {
          id: botUserId,
          type: 1,
          allow: String(BOT_ALLOW),
          deny: "0",
        },
        {
          id: user.id,
          type: 1,
          allow: String(USER_ALLOW),
          deny: "0",
        },
      ];
      for (const roleId of [adminRoleId, staffRoleId]) {
        if (!roleId) continue;
        permission_overwrites.push({
          id: roleId,
          type: 0,
          allow: String(BOT_ALLOW),
          deny: "0",
        });
      }

      ticketChannel = await discordApi(
        botToken,
        "POST",
        `/guilds/${guildId}/channels`,
        {
          name: channelName.slice(0, 100),
          type: 0,
          parent_id: threadParentChannelId,
          topic: `Whitelist · ${displayName} · código ${gameCode}`,
          permission_overwrites,
        },
      );
    } else if (isForum) {
      ticketChannel = await discordApi(
        botToken,
        "POST",
        `/channels/${threadParentChannelId}/threads`,
        {
          name: channelName.slice(0, 100),
          auto_archive_duration: 10080,
          message: {
            content: `<@${user.id}> Formulário whitelist · código \`${gameCode}\``,
            embeds: [firstEmbed],
          },
        },
      );
      botMsgId = String(ticketChannel.id);
    } else {
      try {
        ticketChannel = await discordApi(
          botToken,
          "POST",
          `/channels/${threadParentChannelId}/threads`,
          {
            name: channelName,
            type: 12,
            invitable: false,
            auto_archive_duration: 10080,
          },
        );
      } catch (privateErr) {
        console.error("private thread failed, trying public", privateErr);
        ticketChannel = await discordApi(
          botToken,
          "POST",
          `/channels/${threadParentChannelId}/threads`,
          {
            name: channelName,
            type: 11,
            auto_archive_duration: 10080,
          },
        );
      }
    }
  } catch (err) {
    return {
      ok: false as const,
      error: `Falha ao criar ticket: ${
        err instanceof Error ? err.message : "erro"
      }`,
    };
  }

  const ticketId = String(ticketChannel.id);

  if (!isCategory) {
    try {
      await discordApi(
        botToken,
        "PUT",
        `/channels/${ticketId}/thread-members/${user.id}`,
      );
    } catch (err) {
      console.error("add thread member failed", err);
    }
  }

  const { data: application, error: appErr } = await admin
    .from("whitelist_applications")
    .insert({
      discord_id: user.id,
      discord_username: displayName,
      discord_avatar_url: avatarUrl,
      game_code: gameCode,
      status: "in_progress",
      discord_thread_id: ticketId,
      current_question_index: 0,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (appErr || !application) {
    try {
      await discordApi(botToken, "DELETE", `/channels/${ticketId}`);
    } catch {
      /* ignore */
    }
    return {
      ok: false as const,
      error: appErr?.message ?? "Falha ao criar formulário.",
    };
  }

  if (!botMsgId) {
    try {
      const msg = await discordApi(
        botToken,
        "POST",
        `/channels/${ticketId}/messages`,
        {
          content: `<@${user.id}>`,
          embeds: [firstEmbed],
        },
      );
      botMsgId = String(msg.id);
    } catch (err) {
      console.error("first question failed", err);
    }
  }

  if (botMsgId) {
    await admin
      .from("whitelist_applications")
      .update({
        last_bot_message_id: botMsgId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", application.id);
  }

  return {
    ok: true as const,
    threadId: ticketId,
    applicationId: application.id as string,
  };
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return new Response("discord-interactions ok", { status: 200 });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY");
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!publicKey || !botToken || !supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const signature = req.headers.get("X-Signature-Ed25519");
  const timestamp = req.headers.get("X-Signature-Timestamp");
  const body = await req.text();

  if (!signature || !timestamp) {
    return new Response("Missing signature", { status: 401 });
  }

  let valid = false;
  try {
    valid = verifyDiscordRequest(publicKey, signature, timestamp, body);
  } catch (err) {
    console.error("verify error", err);
  }
  if (!valid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body) as Interaction;

  // PING
  if (interaction.type === 1) {
    return interactionJson({ type: 1 });
  }

  if (
    interaction.type === 5 &&
    (interaction.data?.custom_id ?? "").startsWith("ticket_modal:")
  ) {
    const applicationId = interaction.application_id ?? "";
    const interactionToken = interaction.token ?? "";
    const customId = interaction.data?.custom_id ?? "";

    EdgeRuntime.waitUntil(
      (async () => {
        const reply = async (content: string) => {
          if (!applicationId || !interactionToken) return;
          await editOriginalInteraction(
            applicationId,
            interactionToken,
            content,
          );
        };
        try {
          const kindRaw = customId.slice("ticket_modal:".length);
          if (!isSupportTicketKind(kindRaw)) {
            await reply("Tipo de ticket inválido.");
            return;
          }

          const rows = interaction.data?.components ?? [];
          let subject = "";
          let description = "";
          for (const row of rows) {
            for (const comp of row.components ?? []) {
              if (comp.custom_id === "ticket_subject") {
                subject = (comp.value ?? "").trim();
              }
              if (comp.custom_id === "ticket_body") {
                description = (comp.value ?? "").trim();
              }
            }
          }

          const admin = createClient(supabaseUrl, serviceKey);
          const cfg = await withCeoAdminRole(
            await loadDiscordRuntimeConfig(admin),
            botToken,
          );
          if (
            cfg.guildId &&
            interaction.guild_id &&
            interaction.guild_id !== cfg.guildId
          ) {
            await reply("Guild não autorizado.");
            return;
          }

          const viewerRoleIds = await loadViewerRoleIds(admin);
          const result = await startSupportTicket({
            admin,
            botToken,
            botUserId: applicationId,
            guildId: interaction.guild_id ?? cfg.guildId ?? "",
            categoryOpenId: cfg.categoryOpenId,
            adminRoleId: cfg.adminRoleId,
            staffRoleId: cfg.staffRoleId,
            viewerRoleIds,
            member: interaction.member,
            kind: kindRaw,
            subject,
            body: description,
          });

          if (!result.ok) {
            await reply(result.error);
            return;
          }
          await reply(
            `Ticket aberto em <#${result.channelId}>. A staff vai te atender por lá.`,
          );
        } catch (err) {
          console.error("ticket_modal failed", err);
          await reply(
            err instanceof Error ? err.message : "Falha ao abrir o ticket.",
          );
        }
      })(),
    );

    return interactionJson({ type: 5, data: { flags: 64 } });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const cfg = await withCeoAdminRole(
    await loadDiscordRuntimeConfig(admin),
    botToken,
  );
  const guildIdEnv = cfg.guildId;
  const categoryInProgress = cfg.categoryInProgressId;
  const categoryFinished = cfg.categoryFinishedId;
  const adminRoleId = cfg.adminRoleId;
  const staffRoleId = cfg.staffRoleId;
  const wlThreadChannelId = cfg.wlThreadChannelId;
  const approvedRoleId = cfg.approvedRoleId;

  if (guildIdEnv && interaction.guild_id && interaction.guild_id !== guildIdEnv) {
    return interactionJson({
      type: 4,
      data: { content: "Guild não autorizado.", flags: 64 },
    });
  }

  const viewerRoleIds = await loadViewerRoleIds(admin);

  // MODAL_SUBMIT — whitelist form
  if (interaction.type === 5) {
    const customId = interaction.data?.custom_id ?? "";
    if (customId === "wl_modal") {
      const rows = interaction.data?.components ?? [];
      let gameCode = "";
      for (const row of rows) {
        for (const comp of row.components ?? []) {
          if (comp.custom_id === "wl_game_code") {
            gameCode = (comp.value ?? "").trim();
          }
        }
      }

      const result = await startWhitelistApplication({
        admin,
        botToken,
        guildId: interaction.guild_id ?? guildIdEnv ?? "",
        threadParentChannelId: wlThreadChannelId,
        member: interaction.member,
        gameCode,
        adminRoleId,
        staffRoleId,
      });

      if (!result.ok) {
        return interactionJson({
          type: 4,
          data: { content: result.error, flags: 64 },
        });
      }

      return interactionJson({
        type: 4,
        data: {
          content: `Formulário aberto! Vá até <#${result.threadId}> e responda as perguntas.`,
          flags: 64,
        },
      });
    }

    if (customId === "beta_redeem_modal") {
      const rows = interaction.data?.components ?? [];
      let keyCode = "";
      let gameCode = "";
      for (const row of rows) {
        for (const comp of row.components ?? []) {
          if (comp.custom_id === "beta_key") keyCode = (comp.value ?? "").trim();
          if (comp.custom_id === "beta_game_code") {
            gameCode = (comp.value ?? "").trim();
          }
        }
      }

      const result = await redeemBetaInvite({
        admin,
        botToken,
        guildId: interaction.guild_id ?? guildIdEnv ?? "",
        approvedRoleId,
        member: interaction.member,
        keyCode,
        gameCode,
      });

      if (!result.ok) {
        return interactionJson({
          type: 4,
          data: { content: result.error, flags: 64 },
        });
      }

      return interactionJson({
        type: 4,
        data: {
          content:
            "Acesso liberado. Sua key foi vinculada ao código do jogo. Entre no servidor.",
          flags: 64,
        },
      });
    }

    return interactionJson({
      type: 4,
      data: { content: "Modal não reconhecido.", flags: 64 },
    });
  }

  // APPLICATION_COMMAND or MESSAGE_COMPONENT
  if (interaction.type === 2 || interaction.type === 3) {
    const customId = interaction.data?.custom_id ?? "";
    const commandName = interaction.data?.name ?? "";
    const channelId = interaction.channel_id;
    const member = interaction.member;
    const actorId = member?.user?.id;

    // Whitelist: open modal
    if (interaction.type === 3 && customId === "wl_start") {
      const { data: embedSettings } = await admin
        .from("whitelist_embed_settings")
        .select("button_label")
        .eq("id", 1)
        .maybeSingle();

      void embedSettings;

      return interactionJson({
        type: 9,
        data: {
          custom_id: "wl_modal",
          title: "Fazer formulário",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "wl_game_code",
                  label: "Código do jogo (6 dígitos)",
                  style: 1,
                  min_length: 6,
                  max_length: 6,
                  placeholder: "482193",
                  required: true,
                },
              ],
            },
          ],
        },
      });
    }

    if (interaction.type === 3 && customId === "beta_redeem_start") {
      return interactionJson({
        type: 9,
        data: {
          custom_id: "beta_redeem_modal",
          title: "Liberar acesso beta",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "beta_key",
                  label: "Código da key",
                  style: 1,
                  min_length: 8,
                  max_length: 20,
                  placeholder: "E4-XXXX-XXXX",
                  required: true,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "beta_game_code",
                  label: "Código do jogo (6 dígitos)",
                  style: 1,
                  min_length: 6,
                  max_length: 6,
                  placeholder: "482193",
                  required: true,
                },
              ],
            },
          ],
        },
      });
    }

    if (interaction.type === 3 && customId.startsWith("ticket_start:")) {
      const kindRaw = customId.slice("ticket_start:".length);
      if (!isSupportTicketKind(kindRaw)) {
        return interactionJson({
          type: 4,
          data: { content: "Tipo de ticket inválido.", flags: 64 },
        });
      }
      const kindLabel = SUPPORT_KIND_LABEL[kindRaw];
      return interactionJson({
        type: 9,
        data: {
          custom_id: `ticket_modal:${kindRaw}`,
          title: `Abrir ticket · ${kindLabel}`.slice(0, 45),
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "ticket_subject",
                  label: "Assunto",
                  style: 1,
                  min_length: 3,
                  max_length: 100,
                  placeholder: "Resumo do que você precisa",
                  required: true,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "ticket_body",
                  label: "Descrição",
                  style: 2,
                  min_length: 10,
                  max_length: 1000,
                  placeholder: "Detalhe o problema, dúvida ou reporte.",
                  required: true,
                },
              ],
            },
          ],
        },
      });
    }

    if (
      interaction.type === 3 &&
      customId.startsWith("donation_claim:")
    ) {
      const orderId = customId.slice("donation_claim:".length);
      if (!memberMayModerate(member, viewerRoleIds, adminRoleId, staffRoleId)) {
        return interactionJson({
          type: 4,
          data: {
            content: "Você não tem permissão para assumir este ticket.",
            flags: 64,
          },
        });
      }
      if (!channelId || !categoryInProgress) {
        return interactionJson({
          type: 4,
          data: {
            content: "Configuração incompleta (categoria Ticket | Em andamento).",
            flags: 64,
          },
        });
      }

      const { data: ticket } = await admin
        .from("donation_tickets")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      if (!ticket) {
        return interactionJson({
          type: 4,
          data: { content: "Ticket não encontrado no banco.", flags: 64 },
        });
      }
      if (ticket.status === "finished") {
        return interactionJson({
          type: 4,
          data: { content: "Este ticket já foi finalizado.", flags: 64 },
        });
      }
      if (ticket.status === "in_progress" && ticket.claimed_by_discord_id) {
        return interactionJson({
          type: 4,
          data: {
            content: `Já assumido por <@${ticket.claimed_by_discord_id}>.`,
            flags: 64,
          },
        });
      }

      try {
        await discordApi(botToken, "PATCH", `/channels/${channelId}`, {
          parent_id: categoryInProgress,
        });
      } catch (err) {
        console.error(err);
        return interactionJson({
          type: 4,
          data: {
            content: `Falha ao mover canal: ${
              err instanceof Error ? err.message : "erro"
            }`,
            flags: 64,
          },
        });
      }

      await admin
        .from("donation_tickets")
        .update({
          status: "in_progress",
          claimed_by_discord_id: actorId ?? null,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      return interactionJson({
        type: 4,
        data: {
          content: `<@${actorId}> assumiu este ticket. Canal movido para **Ticket | Em andamento**.`,
        },
      });
    }

    if (interaction.type === 3 && customId.startsWith("ticket_claim:")) {
      const ticketId = customId.slice("ticket_claim:".length);
      if (!memberMayModerate(member, viewerRoleIds, adminRoleId, staffRoleId)) {
        return interactionJson({
          type: 4,
          data: {
            content: "Você não tem permissão para assumir este ticket.",
            flags: 64,
          },
        });
      }
      if (!channelId || !categoryInProgress) {
        return interactionJson({
          type: 4,
          data: {
            content: "Configuração incompleta (categoria Ticket | Em andamento).",
            flags: 64,
          },
        });
      }
      const result = await claimSupportTicket({
        admin,
        botToken,
        channelId,
        categoryInProgress,
        actorId,
        ticketId,
      });
      if (!result.ok) {
        return interactionJson({
          type: 4,
          data: { content: result.error, flags: 64 },
        });
      }
      return interactionJson({
        type: 4,
        data: { content: result.content },
      });
    }

    if (interaction.type === 3 && customId.startsWith("ticket_close:")) {
      const ticketId = customId.slice("ticket_close:".length);
      if (!memberMayModerate(member, viewerRoleIds, adminRoleId, staffRoleId)) {
        return interactionJson({
          type: 4,
          data: {
            content: "Você não tem permissão para encerrar este ticket.",
            flags: 64,
          },
        });
      }
      const { data: ticket } = await admin
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId)
        .maybeSingle();
      if (!ticket) {
        return interactionJson({
          type: 4,
          data: { content: "Ticket não encontrado no banco.", flags: 64 },
        });
      }
      const result = await closeSupportTicket({
        admin,
        botToken,
        categoryFinished,
        actorId,
        ticket: ticket as SupportTicketRow,
      });
      if (!result.ok) {
        return interactionJson({
          type: 4,
          data: { content: result.error, flags: 64 },
        });
      }
      return interactionJson({
        type: 4,
        data: { content: result.content },
      });
    }

    if (
      interaction.type === 2 &&
      (commandName === "comprovante-aprovado" ||
        commandName === "comprovante_aprovado")
    ) {
      if (!memberMayModerate(member, viewerRoleIds, adminRoleId, staffRoleId)) {
        return interactionJson({
          type: 4,
          data: {
            content: "Você não tem permissão para aprovar comprovantes.",
            flags: 64,
          },
        });
      }
      if (!channelId || !categoryFinished) {
        return interactionJson({
          type: 4,
          data: {
            content: "Configuração incompleta (categoria Ticket | Finalizado).",
            flags: 64,
          },
        });
      }

      const { data: ticket } = await admin
        .from("donation_tickets")
        .select("*")
        .eq("discord_channel_id", channelId)
        .maybeSingle();

      if (!ticket) {
        return interactionJson({
          type: 4,
          data: {
            content:
              "Este canal não é um ticket de doação registrado no site.",
            flags: 64,
          },
        });
      }
      if (ticket.status === "finished") {
        return interactionJson({
          type: 4,
          data: { content: "Ticket já finalizado.", flags: 64 },
        });
      }

      const paid = await markTicketPaid(admin, ticket.order_id);
      if (!paid.ok) {
        return interactionJson({
          type: 4,
          data: { content: paid.error, flags: 64 },
        });
      }

      try {
        await discordApi(botToken, "PATCH", `/channels/${channelId}`, {
          parent_id: categoryFinished,
        });
      } catch (err) {
        console.error("move finished failed", err);
      }

      try {
        const { data: buyerProfile } = await admin
          .from("profiles")
          .select("discord_id")
          .eq("id", ticket.user_id)
          .maybeSingle();
        if (buyerProfile?.discord_id) {
          await discordApi(
            botToken,
            "DELETE",
            `/channels/${channelId}/permissions/${buyerProfile.discord_id}`,
          );
        }
      } catch (err) {
        console.error("revoke buyer channel access failed", err);
      }

      await admin
        .from("donation_tickets")
        .update({
          status: "finished",
          finished_at: new Date().toISOString(),
          claimed_by_discord_id:
            ticket.claimed_by_discord_id ?? actorId ?? null,
          claimed_at: ticket.claimed_at ?? new Date().toISOString(),
        })
        .eq("id", ticket.id);

      const already = "already" in paid && paid.already;
      return interactionJson({
        type: 4,
        data: {
          content: already
            ? `Pedido \`${ticket.order_id}\` já estava pago. Canal movido para **Ticket | Finalizado** (acesso do doador removido).`
            : `Comprovante aprovado por <@${actorId}>. Pedido \`${ticket.order_id}\` marcado como **pago** e entrega enfileirada. Canal → **Ticket | Finalizado**. O doador deixa de ver o canal.`,
        },
      });
    }

    if (interaction.type === 2 && commandName === "encerrar") {
      if (!memberMayModerate(member, viewerRoleIds, adminRoleId, staffRoleId)) {
        return interactionJson({
          type: 4,
          data: {
            content: "Você não tem permissão para encerrar tickets.",
            flags: 64,
          },
        });
      }
      if (!channelId) {
        return interactionJson({
          type: 4,
          data: { content: "Use este comando no canal do ticket.", flags: 64 },
        });
      }

      const { data: donation } = await admin
        .from("donation_tickets")
        .select("id")
        .eq("discord_channel_id", channelId)
        .maybeSingle();
      if (donation) {
        return interactionJson({
          type: 4,
          data: {
            content:
              "Este é um ticket de **doação**. Use `/comprovante-aprovado` para marcar o pedido como pago.",
            flags: 64,
          },
        });
      }

      const { data: ticket } = await admin
        .from("support_tickets")
        .select("*")
        .eq("discord_channel_id", channelId)
        .maybeSingle();
      if (!ticket) {
        return interactionJson({
          type: 4,
          data: {
            content: "Este canal não é um ticket de suporte registrado no site.",
            flags: 64,
          },
        });
      }

      const result = await closeSupportTicket({
        admin,
        botToken,
        categoryFinished,
        actorId,
        ticket: ticket as SupportTicketRow,
      });
      if (!result.ok) {
        return interactionJson({
          type: 4,
          data: { content: result.error, flags: 64 },
        });
      }
      return interactionJson({
        type: 4,
        data: { content: result.content },
      });
    }

    return interactionJson({
      type: 4,
      data: {
        content: "Interação não reconhecida neste endpoint.",
        flags: 64,
      },
    });
  }

  return interactionJson({ type: 1 });
});
