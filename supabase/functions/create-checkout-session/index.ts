import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const siteUrl =
      Deno.env.get("SITE_URL") || "http://localhost:5173";

    if (!stripeKey || !supabaseUrl || !anonKey || !serviceKey) {
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

    const body = await req.json();
    const items = body?.items as
      | { productId: string; quantity: number }[]
      | undefined;
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: "Cart is empty" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const productIds = items.map((i) => i.productId);
    const { data: products, error: prodErr } = await admin
      .from("store_products")
      .select("*")
      .in("id", productIds)
      .eq("is_active", true);

    if (prodErr) return json({ error: prodErr.message }, 500);
    if (!products || products.length === 0) {
      return json({ error: "No valid products" }, 400);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let total = 0;
    const lineRows: {
      product_id: string;
      quantity: number;
      unit_price_cents: number;
      delivery_payload: unknown;
    }[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return json({ error: `Product not found: ${item.productId}` }, 400);
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      total += product.price_cents * qty;
      lineRows.push({
        product_id: product.id,
        quantity: qty,
        unit_price_cents: product.price_cents,
        delivery_payload: product.delivery_payload ?? {},
      });
    }

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        status: "pending",
        total_cents: total,
        payment_method: "stripe",
      })
      .select()
      .single();

    if (orderErr || !order) {
      return json({ error: orderErr?.message ?? "Order failed" }, 500);
    }

    const { error: itemsErr } = await admin.from("order_items").insert(
      lineRows.map((row) => ({ ...row, order_id: order.id })),
    );
    if (itemsErr) {
      await admin.from("orders").delete().eq("id", order.id);
      return json({ error: itemsErr.message }, 500);
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-11-20.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "pt-BR",
      client_reference_id: order.id,
      customer_email: user.email ?? undefined,
      // Omit payment_method_types → Stripe usa métodos habilitados no Dashboard (card/Pix/etc.)
      line_items: lineRows.map((row) => {
        const product = productMap.get(row.product_id)!;
        return {
          quantity: row.quantity,
          price_data: {
            currency: "brl",
            unit_amount: row.unit_price_cents,
            product_data: {
              name: product.name,
              description: product.description?.slice(0, 200) || undefined,
            },
          },
        };
      }),
      success_url: `${siteUrl}/loja/carrinho?success=1&order=${order.id}`,
      cancel_url: `${siteUrl}/loja/carrinho?cancelled=1`,
      metadata: {
        order_id: order.id,
        user_id: user.id,
      },
    });

    await admin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return json({ url: session.url, orderId: order.id });
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    );
  }
});
