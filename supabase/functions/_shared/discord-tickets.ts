export const VIEW_CHANNEL = 1 << 10;
export const SEND_MESSAGES = 1 << 11;
export const EMBED_LINKS = 1 << 14;
export const ATTACH_FILES = 1 << 15;
export const READ_MESSAGE_HISTORY = 1 << 16;

export const STAFF_ALLOW =
  VIEW_CHANNEL |
  SEND_MESSAGES |
  READ_MESSAGE_HISTORY |
  EMBED_LINKS |
  ATTACH_FILES;

export const MEMBER_ALLOW =
  VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY | ATTACH_FILES;

export type SupportTicketKind = "duvida" | "suporte" | "reporte";

export const SUPPORT_KIND_LABEL: Record<SupportTicketKind, string> = {
  duvida: "Dúvida",
  suporte: "Suporte",
  reporte: "Reporte",
};

export function isSupportTicketKind(value: string): value is SupportTicketKind {
  return value === "duvida" || value === "suporte" || value === "reporte";
}

export function sanitizeChannelPart(raw: string) {
  return (
    raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "user"
  );
}

export function uniqueIds(...lists: (string | undefined | null)[][]) {
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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function discordApi(
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

export type ChannelOverwrite = {
  id: string;
  type: 0 | 1;
  allow: string;
  deny: string;
};

export function privateTicketOverwrites(opts: {
  guildId: string;
  botUserId: string;
  memberDiscordId: string;
  staffRoleIds: string[];
}): ChannelOverwrite[] {
  const overwrites: ChannelOverwrite[] = [
    {
      id: opts.guildId,
      type: 0,
      allow: "0",
      deny: String(VIEW_CHANNEL),
    },
    {
      id: opts.botUserId,
      type: 1,
      allow: String(STAFF_ALLOW),
      deny: "0",
    },
    {
      id: opts.memberDiscordId,
      type: 1,
      allow: String(MEMBER_ALLOW),
      deny: "0",
    },
  ];
  for (const roleId of opts.staffRoleIds) {
    overwrites.push({
      id: roleId,
      type: 0,
      allow: String(STAFF_ALLOW),
      deny: "0",
    });
  }
  return overwrites;
}

/** Staff + bot always see the 3 categories; @everyone never does. */
export async function syncTicketCategoryVisibility(
  token: string,
  guildId: string,
  categoryIds: string[],
  staffRoleIds: string[],
  botUserId: string,
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
    await discordApi(
      token,
      "PUT",
      `/channels/${categoryId}/permissions/${botUserId}`,
      { type: 1, allow: String(VIEW_CHANNEL), deny: "0" },
    );
  }
}

export async function postChannelMessageWithRetry(
  token: string,
  channelId: string,
  payload: unknown,
) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await sleep(500);
      const message = await discordApi(
        token,
        "POST",
        `/channels/${channelId}/messages`,
        payload,
      );
      return { ok: true as const, messageId: String(message.id) };
    } catch (err) {
      lastError = err;
      console.error(`Failed to post ticket message (attempt ${attempt + 1})`, err);
    }
  }
  return { ok: false as const, error: lastError };
}

export async function moveTicketChannel(
  token: string,
  channelId: string,
  parentId: string,
) {
  await discordApi(token, "PATCH", `/channels/${channelId}`, {
    parent_id: parentId,
  });
}

export async function revokeMemberChannelAccess(
  token: string,
  channelId: string,
  memberDiscordId: string,
) {
  if (!memberDiscordId) return;
  try {
    await discordApi(
      token,
      "DELETE",
      `/channels/${channelId}/permissions/${memberDiscordId}`,
    );
  } catch (err) {
    console.error("revoke member channel access failed", err);
  }
}

export async function finishPrivateTicketChannel(opts: {
  token: string;
  channelId: string;
  categoryFinishedId?: string;
  openerDiscordId: string;
}) {
  if (opts.categoryFinishedId) {
    try {
      await moveTicketChannel(
        opts.token,
        opts.channelId,
        opts.categoryFinishedId,
      );
    } catch (err) {
      console.error("move finished failed", err);
    }
  }
  await revokeMemberChannelAccess(
    opts.token,
    opts.channelId,
    opts.openerDiscordId,
  );
}
