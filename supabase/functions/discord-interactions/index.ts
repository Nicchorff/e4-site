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

type InteractionMember = {
  user?: { id: string; username?: string };
  roles?: string[];
};

type Interaction = {
  type: number;
  id?: string;
  token?: string;
  guild_id?: string;
  channel_id?: string;
  member?: InteractionMember;
  data?: {
    name?: string;
    custom_id?: string;
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

  const admin = createClient(supabaseUrl, serviceKey);
  const viewerRoleIds = await loadViewerRoleIds(admin);

  // APPLICATION_COMMAND or MESSAGE_COMPONENT
  if (interaction.type === 2 || interaction.type === 3) {
    const customId = interaction.data?.custom_id ?? "";
    const commandName = interaction.data?.name ?? "";
    const channelId = interaction.channel_id;
    const member = interaction.member;
    const actorId = member?.user?.id;

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

      // Remove buyer access so Ticket categories disappear for them if they have no other open channel
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

    if (guildIdEnv && interaction.guild_id && interaction.guild_id !== guildIdEnv) {
      return interactionJson({
        type: 4,
        data: { content: "Guild não autorizado.", flags: 64 },
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
