"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";

const proPrice = process.env.NEXT_PUBLIC_PRO_PRICE_LABEL || "₹499 / month";

export default function PricingPage() {
  const [user, setUser] = useState<any>(null);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) return;

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/billing", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setPlan(data.plan === "pro" ? "pro" : "free");
        }
      } catch {
        // Keep the safe default of the free plan.
      }
    });
  }, []);

  async function startCheckout() {
    if (!user) {
      window.location.href = "/login?next=/pricing";
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Checkout is not configured yet.");
      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout failed.");
      setLoading(false);
    }
  }

  async function manageBilling() {
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Billing portal unavailable.");
      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open billing.");
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8">
        <button onClick={() => (window.location.href = "/")} className="font-bold tracking-tight">
          ⚒️ ForgeAI
        </button>
        <button onClick={() => (window.location.href = "/")} className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">
          Back to builder
        </button>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            ForgeAI Pro
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            Build once. Ship like a studio.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
            Keep the AI builder free to try. Upgrade when you need unlimited shipping, priority generation, and a professional publishing workflow.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 sm:p-9">
            <div className="text-sm font-semibold text-zinc-400">Free</div>
            <div className="mt-3 text-4xl font-black">₹0</div>
            <p className="mt-2 text-sm text-zinc-500">Explore ForgeAI before paying.</p>
            <ul className="mt-8 space-y-4 text-sm text-zinc-300">
              <li>✓ AI website generation</li>
              <li>✓ Project saving</li>
              <li>✓ Live preview</li>
              <li>✓ 1 production deployment / month</li>
            </ul>
            <button onClick={() => (window.location.href = "/")} className="mt-9 w-full rounded-2xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/5">
              Start building
            </button>
          </article>

          <article className="relative overflow-hidden rounded-3xl border border-white/20 bg-white p-7 text-black shadow-2xl shadow-white/5 sm:p-9">
            <div className="absolute right-5 top-5 rounded-full bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Pro</div>
            <div className="text-sm font-semibold text-zinc-500">ForgeAI Pro</div>
            <div className="mt-3 text-4xl font-black">{proPrice}</div>
            <p className="mt-2 text-sm text-zinc-500">For people shipping real client sites.</p>
            <ul className="mt-8 space-y-4 text-sm font-medium text-zinc-800">
              <li>✓ Unlimited AI builds</li>
              <li>✓ Unlimited production deployments</li>
              <li>✓ Priority AI provider when configured</li>
              <li>✓ Custom publishing workflow</li>
              <li>✓ Billing portal and subscription management</li>
            </ul>
            {plan === "pro" ? (
              <button onClick={manageBilling} className="mt-9 w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white hover:bg-zinc-800">
                Manage subscription
              </button>
            ) : (
              <button onClick={startCheckout} disabled={loading} className="mt-9 w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
                {loading ? "Opening checkout…" : "Upgrade to Pro →"}
              </button>
            )}
          </article>
        </div>

        {message && (
          <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-zinc-600">
          Payments are handled by Stripe when billing is configured. ForgeAI never stores card numbers.
        </p>
      </section>
    </main>
  );
}
