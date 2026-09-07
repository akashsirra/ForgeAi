import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getAdminDb } from "../../../../lib/firebase-admin";

function verifyStripeSignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return signatures.some((candidate) => {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(candidate, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

async function updateUser(userId: string, values: Record<string, unknown>) {
  await getAdminDb().collection("users").doc(userId).set(
    {
      ...values,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");

  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  }

  const payload = await req.text();
  if (!verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const event = JSON.parse(payload);
    const object = event?.data?.object;
    const metadataUserId = object?.metadata?.userId;
    const userId = metadataUserId || object?.client_reference_id;

    if (!userId) return NextResponse.json({ received: true });

    if (event.type === "checkout.session.completed") {
      const customerId = typeof object.customer === "string" ? object.customer : null;
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : null;
      await updateUser(userId, {
        plan: "pro",
        subscriptionStatus: "active",
        stripeCustomerId: customerId,
        subscriptionId,
      });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = object;
      const subscriptionUserId = subscription?.metadata?.userId || userId;
      const status = subscription?.status;
      const isPro = ["active", "trialing", "past_due"].includes(status);

      await updateUser(subscriptionUserId, {
        plan: isPro ? "pro" : "free",
        subscriptionStatus: status || "canceled",
        stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
        subscriptionId: typeof subscription.id === "string" ? subscription.id : null,
        currentPeriodEnd: subscription.current_period_end || null,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("STRIPE WEBHOOK ERROR:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
