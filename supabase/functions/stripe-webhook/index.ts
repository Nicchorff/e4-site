import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  order_items: { id: string }[] | null;
};

async function markOrderPaid(
  admin: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
) {
  const orderId =
    session.metadata?.order_id || session.client_reference_id || null;
  if (!orderId) {
    return new Response("No order_id", { status: 400 });
  }

  const { data: order } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return new Response("Order not found", { status: 404 });
  }

  const typed = order as OrderRow;

  if (typed.status === "paid") {
    return new Response(JSON.stringify({ ok: true, already: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
    })
    .eq("id", orderId);

  const { data: profile } = await admin
    .from("profiles")
    .select("discord_id")
    .eq("id", typed.user_id)
    .maybeSingle();

  const discordId = profile?.discord_id ?? "unknown";
  const items = typed.order_items ?? [];

  if (items.length > 0) {
    await admin.from("deliveries").insert(
      items.map((item) => ({
        order_item_id: item.id,
        player_discord_id: discordId,
        status: "pending",
        attempts: 0,
      })),
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2024-11-20.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("Webhook signature failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    // For card, completed is enough; for async (e.g. Pix) wait for succeeded
    if (
      event.type === "checkout.session.completed" &&
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      return new Response(JSON.stringify({ ok: true, waiting: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return await markOrderPaid(admin, session);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
