import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type DiscordRuntimeConfig = {
  guildId: string;
  adminRoleId: string;
  staffRoleId: string;
  categoryOpenId: string;
  categoryInProgressId: string;
  categoryFinishedId: string;
  wlFormChannelId: string;
  wlThreadChannelId: string;
  wlResultFormChannelId: string;
  wlResultInterviewChannelId: string;
  interviewRoleId: string;
  approvedRoleId: string;
  betaAccessCategoryId: string;
  betaAccessChannelId: string;
  ticketPanelChannelId: string;
};

export const DEFAULT_BETA_ACCESS_CATEGORY_ID = "1534358251867607071";
export const DEFAULT_TICKET_PANEL_CHANNEL_ID = "1534356212773032006";

function pick(envKey: string, dbVal?: string | null) {
  return (Deno.env.get(envKey) || dbVal || "").trim();
}

export async function resolveNamedRoleId(
  botToken: string,
  guildId: string,
  names: string[],
): Promise<string> {
  if (!botToken || !guildId || names.length === 0) return "";
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/roles`,
    { headers: { Authorization: `Bot ${botToken}` } },
  );
  if (!res.ok) return "";
  const roles = (await res.json()) as { id: string; name: string }[];
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  const hit = roles.find((r) => wanted.has(String(r.name).toLowerCase()));
  return hit?.id ?? "";
}

/** Site admin panel = Discord role CEO (not the leftover "Admin" the bot created). */
export async function withCeoAdminRole(
  cfg: DiscordRuntimeConfig,
  botToken: string,
): Promise<DiscordRuntimeConfig> {
  const ceoId = await resolveNamedRoleId(botToken, cfg.guildId, ["CEO"]);
  if (!ceoId) return cfg;
  return { ...cfg, adminRoleId: ceoId };
}

export async function loadDiscordRuntimeConfig(
  admin: SupabaseClient,
): Promise<DiscordRuntimeConfig> {
  const { data } = await admin
    .from("discord_runtime_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return {
    guildId: pick("DISCORD_GUILD_ID", data?.guild_id),
    adminRoleId: pick("DISCORD_ADMIN_ROLE_ID", data?.admin_role_id),
    staffRoleId: pick("DISCORD_STAFF_ROLE_ID", data?.staff_role_id),
    categoryOpenId: pick("DISCORD_CATEGORY_OPEN_ID", data?.category_open_id),
    categoryInProgressId: pick(
      "DISCORD_CATEGORY_IN_PROGRESS_ID",
      data?.category_in_progress_id,
    ),
    categoryFinishedId: pick(
      "DISCORD_CATEGORY_FINISHED_ID",
      data?.category_finished_id,
    ),
    wlFormChannelId: pick(
      "DISCORD_WL_FORM_CHANNEL_ID",
      data?.wl_form_channel_id,
    ),
    wlThreadChannelId: pick(
      "DISCORD_WL_THREAD_CHANNEL_ID",
      data?.wl_thread_channel_id,
    ),
    wlResultFormChannelId: pick(
      "DISCORD_WL_RESULT_FORM_CHANNEL_ID",
      data?.wl_result_form_channel_id,
    ),
    wlResultInterviewChannelId: pick(
      "DISCORD_WL_RESULT_INTERVIEW_CHANNEL_ID",
      data?.wl_result_interview_channel_id,
    ),
    interviewRoleId: pick(
      "DISCORD_WL_INTERVIEW_ROLE_ID",
      data?.interview_role_id,
    ),
    approvedRoleId: pick("DISCORD_WL_APPROVED_ROLE_ID", data?.approved_role_id),
    betaAccessCategoryId:
      pick("DISCORD_BETA_ACCESS_CATEGORY_ID", data?.beta_access_category_id) ||
      DEFAULT_BETA_ACCESS_CATEGORY_ID,
    betaAccessChannelId: pick(
      "DISCORD_BETA_ACCESS_CHANNEL_ID",
      data?.beta_access_channel_id,
    ),
    ticketPanelChannelId:
      pick("DISCORD_TICKET_PANEL_CHANNEL_ID", data?.ticket_panel_channel_id) ||
      DEFAULT_TICKET_PANEL_CHANNEL_ID,
  };
}
