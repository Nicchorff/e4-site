import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { loadDiscordRuntimeConfig } from "../_shared/discord-config.ts";

type AppRole = "member" | "staff" | "admin";

type DiscordMember = {
  roles: string[];
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
  nick?: string | null;
};

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

function mapRole(
  memberRoleIds: string[],
  adminRoleId: string,
  staffRoleId: string,
): AppRole {
  if (adminRoleId && memberRoleIds.includes(adminRoleId)) return "admin";
  if (staffRoleId && memberRoleIds.includes(staffRoleId)) return "staff";
  return "member";
}

function extractDiscordId(user: {
  identities?: Array<{ provider?: string; id?: string }>;
  user_metadata?: Record<string, unknown>;
}): string | null {
  const fromIdentity = user.identities?.find((i) => i.provider === "discord")
    ?.id;
  if (fromIdentity) return fromIdentity;

  const meta = user.user_metadata ?? {};
  const candidates = [
    meta.provider_id,
    meta.sub,
    meta.discord_id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

function avatarUrl(discordId: string, avatarHash?: string | null) {
  if (!avatarHash) {
    return `https://cdn.discordapp.com/embed/avatars/${Number(discordId) % 5}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Supabase env missing" }, 500);
    }
    if (!botToken) {
      return json(
        {
          error:
            "Discord bot env missing. Set DISCORD_BOT_TOKEN on this function.",
        },
        500,
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const cfg = await loadDiscordRuntimeConfig(adminClient);
    const guildId = cfg.guildId;

    if (!guildId) {
      return json(
        {
          error:
            "DISCORD_GUILD_ID missing. Run the whitelist bot setup or set the secret.",
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const discordId = extractDiscordId(user);
    if (!discordId) {
      return json(
        { error: "Discord identity not found on this account" },
        400,
      );
    }

    const discordRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (discordRes.status === 404) {
      // User is authenticated but not in the guild → member with no elevated roles
      const username =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        (user.user_metadata?.preferred_username as string | undefined) ||
        "discord-user";
      const avatar =
        (user.user_metadata?.avatar_url as string | undefined) ||
        (user.user_metadata?.picture as string | undefined) ||
        null;

      const { data, error } = await adminClient.from("profiles").upsert(
        {
          id: user.id,
          discord_id: discordId,
          username,
          avatar_url: avatar,
          role: "member",
        },
        { onConflict: "id" },
      ).select().single();

      if (error) return json({ error: error.message }, 500);
      return json({ profile: data, note: "User not in guild" });
    }

    if (!discordRes.ok) {
      const text = await discordRes.text();
      console.error("Discord API error", discordRes.status, text);
      return json(
        { error: "Failed to fetch Discord member", status: discordRes.status },
        502,
      );
    }

    const member = (await discordRes.json()) as DiscordMember;
    const role = mapRole(member.roles ?? [], cfg.adminRoleId, cfg.staffRoleId);
    const username =
      member.nick ||
      member.user?.global_name ||
      member.user?.username ||
      (user.user_metadata?.full_name as string | undefined) ||
      "discord-user";
    const avatar =
      avatarUrl(discordId, member.user?.avatar) ||
      (user.user_metadata?.avatar_url as string | undefined) ||
      null;

    const { data: profile, error: upsertError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: user.id,
          discord_id: discordId,
          username,
          avatar_url: avatar,
          role,
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (upsertError) {
      return json({ error: upsertError.message }, 500);
    }

    return json({ profile });
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    );
  }
});
