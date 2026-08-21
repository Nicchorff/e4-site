import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { loadDiscordRuntimeConfig, withCeoAdminRole } from "../_shared/discord-config.ts";
import { finishPrivateTicketChannel } from "../_shared/discord-tickets.ts";

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
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const ticketId = body?.ticketId as string | undefined;
    if (!ticketId) return json({ error: "ticketId é obrigatório" }, 400);

    const { data: ticket, error: ticketErr } = await admin
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketErr) return json({ error: ticketErr.message }, 500);
    if (!ticket) return json({ error: "Ticket não encontrado" }, 404);
    if (ticket.status === "finished") {
      return json({ ok: true, status: "finished", already: true });
    }

    const cfg = await withCeoAdminRole(
      await loadDiscordRuntimeConfig(admin),
      botToken,
    );

    await finishPrivateTicketChannel({
      token: botToken,
      channelId: ticket.discord_channel_id,
      categoryFinishedId: cfg.categoryFinishedId,
      openerDiscordId: ticket.discord_user_id,
    });

    const now = new Date().toISOString();
    const { error: updateErr } = await admin
      .from("support_tickets")
      .update({
        status: "finished",
        finished_at: now,
        finished_by_discord_id: ticket.finished_by_discord_id ?? "site-admin",
        claimed_by_discord_id: ticket.claimed_by_discord_id,
        claimed_at: ticket.claimed_at,
      })
      .eq("id", ticket.id);

    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({ ok: true, status: "finished" });
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
