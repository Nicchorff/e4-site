import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

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
}) {
  const { admin, botToken, guildId, threadParentChannelId, member, gameCode } =
    opts;

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
      const adminRoleId = Deno.env.get("DISCORD_ADMIN_ROLE_ID");
      const staffRoleId = Deno.env.get("DISCORD_STAFF_ROLE_ID");

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
  const guildIdEnv = Deno.env.get("DISCORD_GUILD_ID");
  const categoryInProgress = Deno.env.get("DISCORD_CATEGORY_IN_PROGRESS_ID");
  const categoryFinished = Deno.env.get("DISCORD_CATEGORY_FINISHED_ID");
  const adminRoleId = Deno.env.get("DISCORD_ADMIN_ROLE_ID");
  const staffRoleId = Deno.env.get("DISCORD_STAFF_ROLE_ID");
  const wlThreadChannelId =
    Deno.env.get("DISCORD_WL_THREAD_CHANNEL_ID") ?? "1509568521129033973";
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

  if (guildIdEnv && interaction.guild_id && interaction.guild_id !== guildIdEnv) {
    return interactionJson({
      type: 4,
      data: { content: "Guild não autorizado.", flags: 64 },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
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
