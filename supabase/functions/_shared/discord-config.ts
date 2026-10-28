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
  pendingRoleId: string;
  betaAccessCategoryId: string;
  betaAccessChannelId: string;
  ticketPanelChannelId: string;
};

export const DEFAULT_BETA_ACCESS_CATEGORY_ID = "1534358251867607071";
export const DEFAULT_TICKET_PANEL_CHANNEL_ID = "1534356212773032006";

/** discord_runtime_config wins; DISCORD_* secrets only fill empty columns. */
function pick(envKey: string, dbVal?: string | null) {
  return (dbVal?.trim() || Deno.env.get(envKey) || "").trim();
}

/**
 * Site admin panel = admin_role_id (fallback DISCORD_ADMIN_ROLE_ID; today: CS).
 * No match by role name.
 */
export async function withCeoAdminRole(
  cfg: DiscordRuntimeConfig,
  _botToken: string,
): Promise<DiscordRuntimeConfig> {
  return cfg;
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
    pendingRoleId: pick("DISCORD_PENDING_ROLE_ID", data?.pending_role_id),
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
