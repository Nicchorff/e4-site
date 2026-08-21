import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { loadDiscordRuntimeConfig, withCeoAdminRole } from "../_shared/discord-config.ts";
import { liberateGameWhitelist } from "../_shared/e4-panel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

async function addRole(
  token: string,
  guildId: string,
  userId: string,
  roleId: string,
) {
  await discordApi(
    token,
    "PUT",
    `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
  );
}

async function removeRole(
  token: string,
  guildId: string,
  userId: string,
  roleId: string,
) {
  try {
    await discordApi(
      token,
      "DELETE",
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    );
  } catch (err) {
    console.error("removeRole failed", err);
  }
}

async function archiveThread(token: string, threadId: string | null) {
  if (!threadId) return;
  try {
    // Works for threads; for ticket text channels just lock name prefix
    await discordApi(token, "PATCH", `/channels/${threadId}`, {
      archived: true,
      locked: true,
    });
  } catch {
    try {
      const ch = await discordApi(token, "GET", `/channels/${threadId}`);
      const name = String(ch.name ?? "wl");
      await discordApi(token, "PATCH", `/channels/${threadId}`, {
        name: name.startsWith("closed-") ? name : `closed-${name}`.slice(0, 100),
      });
    } catch (err) {
      console.error("archiveThread failed", err);
    }
  }
}

async function postResult(
  token: string,
  channelId: string,
  embed: Record<string, unknown>,
  content?: string,
) {
  await discordApi(token, "POST", `/channels/${channelId}/messages`, {
    content: content ?? undefined,
    embeds: [embed],
  });
}

type Action =
  | "approve_form"
  | "reject_form"
  | "approve_interview"
  | "reject_interview";

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

    if (!supabaseUrl || !anonKey || !serviceKey || !botToken) {
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

    const admin = createClient(supabaseUrl, serviceKey);
    const cfg = await withCeoAdminRole(
      await loadDiscordRuntimeConfig(admin),
      botToken,
    );
    const guildId = cfg.guildId;
    const resultFormChannel = cfg.wlResultFormChannelId;
    const resultInterviewChannel = cfg.wlResultInterviewChannelId;
    const interviewRoleId = cfg.interviewRoleId;
    const approvedRoleId = cfg.approvedRoleId;

    if (!guildId || !resultFormChannel || !interviewRoleId || !approvedRoleId) {
      return json({ error: "Discord guild config missing. Run bot setup." }, 500);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const action = body?.action as Action | undefined;
    const applicationId = body?.applicationId as string | undefined;
    const reason = (body?.reason as string | undefined)?.trim() ?? "";

    if (!action || !applicationId) {
      return json({ error: "action e applicationId são obrigatórios" }, 400);
    }

    const { data: app, error: appErr } = await admin
      .from("whitelist_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (appErr) return json({ error: appErr.message }, 500);
    if (!app) return json({ error: "Formulário não encontrado" }, 404);

    const mention = `<@${app.discord_id}>`;
    const now = new Date().toISOString();

    if (action === "approve_form") {
      if (app.status !== "pending_review") {
        return json({ error: "Formulário não está pendente de revisão" }, 400);
      }

      await addRole(botToken, guildId, app.discord_id, interviewRoleId);
      await archiveThread(botToken, app.discord_thread_id);

      await admin
        .from("whitelist_applications")
        .update({
          status: "interview",
          reviewed_at: now,
          updated_at: now,
          reject_reason: null,
        })
        .eq("id", app.id);

      await postResult(botToken, resultFormChannel, {
        title: "✅ Formulário aprovado",
        description: `${mention} (**${app.discord_username}**) foi aprovado no formulário e avançou para **entrevista**.\nCódigo: \`${app.game_code}\``,
        color: 0x3ba55d,
        thumbnail: app.discord_avatar_url
          ? { url: app.discord_avatar_url }
          : undefined,
        timestamp: now,
      });

      return json({ ok: true, status: "interview" });
    }

    if (action === "reject_form") {
      if (app.status !== "pending_review") {
        return json({ error: "Formulário não está pendente de revisão" }, 400);
      }

      await archiveThread(botToken, app.discord_thread_id);

      await admin
        .from("whitelist_applications")
        .update({
          status: "rejected_form",
          reviewed_at: now,
          updated_at: now,
          reject_reason: reason || null,
        })
        .eq("id", app.id);

      await postResult(botToken, resultFormChannel, {
        title: "❌ Formulário recusado",
        description: `${mention} (**${app.discord_username}**) teve o formulário **recusado**.${
          reason ? `\nMotivo: ${reason}` : ""
        }\nPode refazer o formulário.`,
        color: 0xed4245,
        thumbnail: app.discord_avatar_url
          ? { url: app.discord_avatar_url }
          : undefined,
        timestamp: now,
      });

      return json({ ok: true, status: "rejected_form" });
    }

    if (action === "approve_interview") {
      if (app.status !== "interview") {
        return json({ error: "Candidato não está em entrevista" }, 400);
      }

      try {
        await liberateGameWhitelist(app.game_code);
      } catch (err) {
        return json(
          {
            error: `Falha ao liberar whitelist no servidor: ${
              err instanceof Error ? err.message : "erro"
            }`,
          },
          502,
        );
      }

      await addRole(botToken, guildId, app.discord_id, approvedRoleId);
      await removeRole(botToken, guildId, app.discord_id, interviewRoleId);

      await admin
        .from("whitelist_applications")
        .update({
          status: "approved",
          interviewed_at: now,
          updated_at: now,
          reject_reason: null,
        })
        .eq("id", app.id);

      await postResult(botToken, resultInterviewChannel, {
        title: "✅ Entrevista aprovada · Whitelist liberada",
        description: `${mention} (**${app.discord_username}**) foi **aprovado** na entrevista.\nCódigo \`${app.game_code}\` liberado no servidor.`,
        color: 0x3ba55d,
        thumbnail: app.discord_avatar_url
          ? { url: app.discord_avatar_url }
          : undefined,
        timestamp: now,
      });

      return json({ ok: true, status: "approved" });
    }

    if (action === "reject_interview") {
      if (app.status !== "interview") {
        return json({ error: "Candidato não está em entrevista" }, 400);
      }
      if (!reason) {
        return json({ error: "Motivo é obrigatório na recusa da entrevista" }, 400);
      }

      await removeRole(botToken, guildId, app.discord_id, interviewRoleId);

      await admin
        .from("whitelist_applications")
        .update({
          status: "rejected_interview",
          interviewed_at: now,
          updated_at: now,
          reject_reason: reason,
        })
        .eq("id", app.id);

      await postResult(botToken, resultInterviewChannel, {
        title: "❌ Entrevista recusada",
        description: `${mention} (**${app.discord_username}**) foi **recusado** na entrevista.\nMotivo: ${reason}\nPode refazer o formulário.`,
        color: 0xed4245,
        thumbnail: app.discord_avatar_url
          ? { url: app.discord_avatar_url }
          : undefined,
        timestamp: now,
      });

      return json({ ok: true, status: "rejected_interview" });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
