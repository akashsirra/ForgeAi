import { getAdminDb } from "./firebase-admin";

export const FREE_DEPLOYMENTS_PER_MONTH = 1;

export type BillingStatus = {
  plan: "free" | "pro";
  status: "free" | "trialing" | "active" | "past_due" | "canceled";
  subscriptionId?: string;
  currentPeriodEnd?: number | null;
};

export function getAppUrl(request?: Request) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    request?.headers.get("origin")?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const snapshot = await getAdminDb().collection("users").doc(userId).get();
  const data = snapshot.data();
  const status = data?.subscriptionStatus;

  if (data?.plan === "pro" && ["active", "trialing"].includes(status)) {
    return {
      plan: "pro",
      status,
      subscriptionId: data.subscriptionId,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
    };
  }

  return { plan: "free", status: "free" };
}

export async function createCheckoutSession({
  userId,
  email,
  request,
}: {
  userId: string;
  email?: string | null;
  request: Request;
}) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secret || !priceId) {
    throw new Error("Stripe billing is not configured on the server.");
  }

  const baseUrl = getAppUrl(request);
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", `${baseUrl}/pricing?success=1`);
  form.set("cancel_url", `${baseUrl}/pricing?canceled=1`);
  form.set("client_reference_id", userId);
  form.set("metadata[userId]", userId);
  form.set("subscription_data[metadata][userId]", userId);
  if (email) form.set("customer_email", email);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data?.error?.message || "Stripe could not create checkout.");
  }

  return data.url as string;
}

export async function createPortalSession({
  userId,
  request,
}: {
  userId: string;
  request: Request;
}) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe billing is not configured on the server.");

  const userSnapshot = await getAdminDb().collection("users").doc(userId).get();
  const customerId = userSnapshot.data()?.stripeCustomerId;
  if (!customerId) throw new Error("No Stripe customer is linked to this account yet.");

  const form = new URLSearchParams();
  form.set("customer", customerId);
  form.set("return_url", `${getAppUrl(request)}/pricing`);

  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data?.error?.message || "Stripe could not open billing management.");
  }

  return data.url as string;
}
