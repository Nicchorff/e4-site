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
};

function pick(envKey: string, dbVal?: string | null) {
  return (Deno.env.get(envKey) || dbVal || "").trim();
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
  };
}
