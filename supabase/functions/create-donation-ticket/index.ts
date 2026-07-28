import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VIEW_CHANNEL = 1 << 10;
const SEND_MESSAGES = 1 << 11;
const EMBED_LINKS = 1 << 14;
const ATTACH_FILES = 1 << 15;
const READ_MESSAGE_HISTORY = 1 << 16;
const STAFF_ALLOW =
  VIEW_CHANNEL |
  SEND_MESSAGES |
  READ_MESSAGE_HISTORY |
  EMBED_LINKS |
  ATTACH_FILES;
const BUYER_ALLOW =
  VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY | ATTACH_FILES;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function sanitizeChannelPart(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "user";
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

/** Staff always sees the 3 categories; @everyone never does (buyers only see via their channel). */
async function syncTicketCategoryVisibility(
  token: string,
  guildId: string,
  categoryIds: string[],
  staffRoleIds: string[],
) {
  for (const categoryId of categoryIds) {
    if (!categoryId) continue;
    await discordApi(
      token,
      "PUT",
      `/channels/${categoryId}/permissions/${guildId}`,
      { type: 0, allow: "0", deny: String(VIEW_CHANNEL) },
    );
    for (const roleId of staffRoleIds) {
      await discordApi(
        token,
        "PUT",
        `/channels/${categoryId}/permissions/${roleId}`,
        { type: 0, allow: String(VIEW_CHANNEL), deny: "0" },
      );
    }
  }
}

function uniqueIds(...lists: (string | undefined | null)[][]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const id of list) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");
    const categoryOpenId = Deno.env.get("DISCORD_CATEGORY_OPEN_ID");
    const categoryInProgressId = Deno.env.get("DISCORD_CATEGORY_IN_PROGRESS_ID");
    const categoryFinishedId = Deno.env.get("DISCORD_CATEGORY_FINISHED_ID");
    const adminRoleId = Deno.env.get("DISCORD_ADMIN_ROLE_ID");
    const staffRoleId = Deno.env.get("DISCORD_STAFF_ROLE_ID");

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceKey ||
      !botToken ||
      !guildId ||
      !categoryOpenId
    ) {
      return json({ error: "Missing server configuration" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const items = body?.items as
      | { productId: string; quantity: number }[]
      | undefined;
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: "Carrinho vazio" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("discord_id, username, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) return json({ error: profileErr.message }, 500);
    if (!profile?.discord_id) {
      return json(
        { error: "Perfil Discord não encontrado. Entre novamente com Discord." },
        400,
      );
    }

    const productIds = items.map((i) => i.productId);
    const { data: products, error: prodErr } = await admin
      .from("store_products")
      .select("*")
      .in("id", productIds)
      .eq("is_active", true);

    if (prodErr) return json({ error: prodErr.message }, 500);
    if (!products || products.length === 0) {
      return json({ error: "Nenhum produto válido" }, 400);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let total = 0;
    const lineRows: {
      product_id: string;
      quantity: number;
      unit_price_cents: number;
      delivery_payload: unknown;
      name: string;
    }[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return json({ error: `Produto não encontrado: ${item.productId}` }, 400);
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      total += product.price_cents * qty;
      lineRows.push({
        product_id: product.id,
        quantity: qty,
        unit_price_cents: product.price_cents,
        delivery_payload: product.delivery_payload ?? {},
        name: product.name,
      });
    }

    const { data: settings } = await admin
      .from("donation_ticket_settings")
      .select("viewer_role_ids")
      .eq("id", 1)
      .maybeSingle();

    const viewerRoleIds = (settings?.viewer_role_ids ?? []) as string[];
    const staffRoleIds = uniqueIds(
      viewerRoleIds,
      [adminRoleId, staffRoleId],
    );

    try {
      await syncTicketCategoryVisibility(
        botToken,
        guildId,
        [categoryOpenId, categoryInProgressId ?? "", categoryFinishedId ?? ""],
        staffRoleIds,
      );
    } catch (err) {
      console.error("category visibility sync failed", err);
      // continue — channel overwrites still protect privacy
    }

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        status: "pending",
        total_cents: total,
        payment_method: "discord_ticket",
      })
      .select()
      .single();

    if (orderErr || !order) {
      return json({ error: orderErr?.message ?? "Falha ao criar pedido" }, 500);
    }

    const { error: itemsErr } = await admin.from("order_items").insert(
      lineRows.map((row) => ({
        order_id: order.id,
        product_id: row.product_id,
        quantity: row.quantity,
        unit_price_cents: row.unit_price_cents,
        delivery_payload: row.delivery_payload,
      })),
    );
    if (itemsErr) {
      await admin.from("orders").delete().eq("id", order.id);
      return json({ error: itemsErr.message }, 500);
    }

    const shortId = String(order.id).replace(/-/g, "").slice(0, 8);
    const channelName = `doacao-${sanitizeChannelPart(profile.username)}-${shortId}`
      .slice(0, 100);

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
        id: profile.discord_id,
        type: 1,
        allow: String(BUYER_ALLOW),
        deny: "0",
      },
    ];

    for (const roleId of staffRoleIds) {
      permission_overwrites.push({
        id: roleId,
        type: 0,
        allow: String(STAFF_ALLOW),
        deny: "0",
      });
    }

    let channel: Record<string, unknown>;
    try {
      channel = await discordApi(botToken, "POST", `/guilds/${guildId}/channels`, {
        name: channelName,
        type: 0,
        parent_id: categoryOpenId,
        topic: `Doação E4 · pedido ${order.id}`,
        permission_overwrites,
      });
    } catch (err) {
      await admin.from("orders").delete().eq("id", order.id);
      throw err;
    }

    const channelId = String(channel.id);
    const linesText = lineRows
      .map(
        (r) =>
          `• **${r.name}** × ${r.quantity} — ${formatBrl(r.unit_price_cents * r.quantity)}`,
      )
      .join("\n");

    const embed = {
      title: "Nova doação · ticket aberto",
      color: 0xf2b705,
      description:
        "Assim que possível alguém irá te atender.\nEnvie o comprovante neste canal.",
      fields: [
        {
          name: "Doador",
          value: `<@${profile.discord_id}> (\`${profile.username}\`)`,
          inline: false,
        },
        { name: "Itens", value: linesText.slice(0, 1024) || "—", inline: false },
        { name: "Total", value: formatBrl(total), inline: true },
        {
          name: "Pedido",
          value: `\`${order.id}\``,
          inline: true,
        },
      ],
      footer: { text: "Elite Four · doação via ticket" },
      timestamp: new Date().toISOString(),
    };

    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: "Assumir",
            custom_id: `donation_claim:${order.id}`,
          },
        ],
      },
    ];

    let messageId: string | null = null;
    try {
      const message = await discordApi(
        botToken,
        "POST",
        `/channels/${channelId}/messages`,
        {
          content: `<@${profile.discord_id}>`,
          embeds: [embed],
          components,
        },
      );
      messageId = String(message.id);
    } catch (err) {
      console.error("Failed to post ticket message", err);
    }

    const { error: ticketErr } = await admin.from("donation_tickets").insert({
      order_id: order.id,
      user_id: user.id,
      discord_channel_id: channelId,
      discord_message_id: messageId,
      status: "open",
    });

    if (ticketErr) {
      console.error("donation_tickets insert failed", ticketErr);
      return json(
        {
          error: ticketErr.message,
          channelUrl: `https://discord.com/channels/${guildId}/${channelId}`,
          orderId: order.id,
        },
        500,
      );
    }

    return json({
      channelUrl: `https://discord.com/channels/${guildId}/${channelId}`,
      orderId: order.id,
      channelId,
    });
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    );
  }
});
