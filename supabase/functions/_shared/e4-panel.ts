export type PanelAccount = {
  id: number;
  wl_code: string;
  whitelist: number;
  discord: string;
  license: string;
};

function panelConfig() {
  const url = (Deno.env.get("E4_PANEL_URL") || "").trim().replace(/\/$/, "");
  const token = (Deno.env.get("E4_PANEL_SITE_TOKEN") || "").trim();
  return { url, token };
}

export function panelConfigured() {
  const { url, token } = panelConfig();
  return Boolean(url && token);
}

async function panelPost(
  pathname: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const { url, token } = panelConfig();
  if (!url || !token) {
    throw new Error("E4_PANEL_URL / E4_PANEL_SITE_TOKEN não configurados");
  }

  const res = await fetch(`${url}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    data = { error: text };
  }
  return { status: res.status, data };
}

function asAccount(raw: unknown): PanelAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.id == null || !row.wl_code) return null;
  return {
    id: Number(row.id),
    wl_code: String(row.wl_code),
    whitelist: Number(row.whitelist) ? 1 : 0,
    discord: String(row.discord ?? "0"),
    license: String(row.license ?? "0"),
  };
}

export async function panelLookupAccount(code: string): Promise<
  { ok: true; account: PanelAccount } | { ok: false; error: string; status: number }
> {
  const { status, data } = await panelPost("/api/site/account", { code });
  const account = asAccount(data.account);
  if (status === 200 && account) return { ok: true, account };
  return {
    ok: false,
    status,
    error: String(data.error || "panel_lookup_failed"),
  };
}

export async function panelLiberateWhitelist(code: string): Promise<
  { ok: true; account: PanelAccount } | { ok: false; error: string; status: number }
> {
  const { status, data } = await panelPost("/api/site/whitelist", { code });
  const account = asAccount(data.account);
  if (status === 200 && account) return { ok: true, account };
  return {
    ok: false,
    status,
    error: String(data.error || "panel_whitelist_failed"),
  };
}

/** Fallback for interview flow if the VPS panel is not configured yet. */
export async function liberateWhitelistFallback(gameCode: string) {
  const url =
    Deno.env.get("FIVEM_WHITELIST_URL") ??
    "http://127.0.0.1:30120/vrp/whitelist";
  const auth = Deno.env.get("FIVEM_WHITELIST_TOKEN");
  if (!auth) {
    throw new Error("FIVEM_WHITELIST_TOKEN não configurado");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify({ code: gameCode, whitelist: 1 }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`vRP whitelist failed (${res.status}): ${text}`);
  }
  return text;
}

export async function liberateGameWhitelist(gameCode: string): Promise<{
  account: PanelAccount | null;
}> {
  if (panelConfigured()) {
    const result = await panelLiberateWhitelist(gameCode);
    if (!result.ok) {
      throw new Error(
        result.error === "code_not_found"
          ? "Código do jogo não encontrado no servidor"
          : `Painel recusou a liberação (${result.error})`,
      );
    }
    return { account: result.account };
  }
  await liberateWhitelistFallback(gameCode);
  return { account: null };
}
