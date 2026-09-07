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
  const [billingReady, setBillingReady] = useState(true);

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
        // Safe default: free plan.
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
      setBillingReady(false);
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
    <main className="min-h-screen overflow-x-hidden bg-[#070707] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_38%)]" />
      <header className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-8">
        <button onClick={() => (window.location.href = "/")} className="shrink-0 font-bold tracking-tight">
          ⚒️ ForgeAI
        </button>
        <button onClick={() => (window.location.href = "/")} className="rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 sm:px-4 sm:text-sm">
          Back to builder
        </button>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 sm:text-xs">
            ForgeAI Pro
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            Build once. Ship like a studio.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-lg sm:leading-7">
            Start free. Upgrade when ForgeAI becomes part of your workflow.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl items-stretch gap-5 md:grid-cols-2">
          <article className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-9">
            <div className="text-sm font-semibold text-zinc-400">Free</div>
            <div className="mt-3 text-4xl font-black">₹0</div>
            <p className="mt-2 text-sm text-zinc-500">Try the complete builder before upgrading.</p>
            <ul className="mt-7 flex-1 space-y-3 text-sm text-zinc-300 sm:mt-8 sm:space-y-4">
              <li>✓ AI website generation</li>
              <li>✓ Project saving</li>
              <li>✓ Live preview</li>
              <li>✓ 1 production deployment / month</li>
            </ul>
            <button onClick={() => (window.location.href = "/")} className="mt-8 w-full rounded-2xl border border-white/10 px-5 py-3.5 font-semibold hover:bg-white/5">
              Start building free
            </button>
          </article>

          <article className="relative flex flex-col overflow-hidden rounded-3xl border border-white/20 bg-white p-6 text-black shadow-2xl shadow-white/5 sm:p-9">
            <div className="absolute right-4 top-4 rounded-full bg-black px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white sm:right-5 sm:top-5 sm:text-[10px]">Most useful</div>
            <div className="pr-20 text-sm font-semibold text-zinc-500">ForgeAI Pro</div>
            <div className="mt-3 text-4xl font-black">{proPrice}</div>
            <p className="mt-2 text-sm text-zinc-500">For freelancers, creators and people shipping real sites.</p>
            <ul className="mt-7 flex-1 space-y-3 text-sm font-medium text-zinc-800 sm:mt-8 sm:space-y-4">
              <li>✓ Unlimited AI builds</li>
              <li>✓ Unlimited production deployments</li>
              <li>✓ Priority AI provider when configured</li>
              <li>✓ Professional publishing workflow</li>
              <li>✓ Billing portal and subscription management</li>
            </ul>
            {plan === "pro" ? (
              <button onClick={manageBilling} className="mt-8 w-full rounded-2xl bg-black px-5 py-3.5 font-semibold text-white hover:bg-zinc-800">
                Manage subscription
              </button>
            ) : (
              <button onClick={startCheckout} disabled={loading} className="mt-8 w-full rounded-2xl bg-black px-5 py-3.5 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
                {loading ? "Opening checkout…" : "Upgrade to Pro →"}
              </button>
            )}
          </article>
        </div>

        <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center">
            <div className="text-sm font-semibold">Build faster</div>
            <div className="mt-1 text-xs text-zinc-500">Turn an idea into a site in minutes.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center">
            <div className="text-sm font-semibold">Ship more</div>
            <div className="mt-1 text-xs text-zinc-500">Keep iterating without deployment friction.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center">
            <div className="text-sm font-semibold">Stay in control</div>
            <div className="mt-1 text-xs text-zinc-500">Manage projects and billing from one place.</div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <h2 className="text-lg font-bold">Questions</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">Can I try it first?</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Yes. The free plan includes generation, saving, preview and one production deployment each month.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Can I cancel?</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Pro subscriptions can be managed through the Stripe billing portal.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Do you store my card?</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">No. Payment details are handled by Stripe.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">What if billing isn't live yet?</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">The upgrade button reports the configuration state instead of pretending a payment succeeded.</p>
            </div>
          </div>
        </div>

        {message && (
          <div className={`mx-auto mt-6 max-w-4xl rounded-2xl border p-4 text-sm ${billingReady ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-amber-500/20 bg-amber-500/10 text-amber-200"}`}>
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
