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
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

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

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from("deliveries")
    .select(
      "id, player_discord_id, status, attempts, order_item:order_items(id, delivery_payload, product:store_products(name))",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) return json({ error: error.message }, 500);

  return json({
    deliveries: (data ?? []).map((d) => ({
      id: d.id,
      player_discord_id: d.player_discord_id,
      status: d.status,
      attempts: d.attempts,
      payload: d.order_item?.delivery_payload ?? {},
      product_name: d.order_item?.product?.name ?? null,
    })),
  });
});
