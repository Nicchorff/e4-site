import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
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

  const expected = Deno.env.get("FIVEM_API_KEY");
  const provided = req.headers.get("x-api-key");
  if (!expected || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Misconfigured" }, 500);
  }

  let body: {
    deliveryId?: string;
    status?: string;
    errorMessage?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { deliveryId, status, errorMessage } = body;
  if (
    !deliveryId ||
    !status ||
    !["processing", "delivered", "failed"].includes(status)
  ) {
    return json({ error: "Invalid payload" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const patch: Record<string, unknown> = { status };
  if (status === "delivered") {
    patch.delivered_at = new Date().toISOString();
    patch.error_message = null;
  }
  if (status === "failed") {
    patch.error_message = errorMessage ?? "failed";
  }
  if (status === "processing") {
    const { data: current } = await admin
      .from("deliveries")
      .select("attempts")
      .eq("id", deliveryId)
      .maybeSingle();
    patch.attempts = (current?.attempts ?? 0) + 1;
  }

  const { data, error } = await admin
    .from("deliveries")
    .update(patch)
    .eq("id", deliveryId)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ delivery: data });
});
