export const metadata = {
  title: "Privacy — ForgeAI",
  description: "ForgeAI privacy information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-12 text-zinc-100 sm:px-8">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm text-zinc-400 hover:text-white">← Back to ForgeAI</a>
        <h1 className="mt-8 text-4xl font-black tracking-tight">Privacy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: September 7, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-zinc-300">
          <section><h2 className="text-xl font-bold text-white">What we collect</h2><p className="mt-2">ForgeAI may process your account information, project prompts, generated website content, deployment metadata, and billing status so the service can save projects, generate websites, deploy them, and manage subscriptions.</p></section>
          <section><h2 className="text-xl font-bold text-white">AI processing</h2><p className="mt-2">Website prompts may be sent to the AI provider configured by ForgeAI. Server-side API keys are not exposed to your browser. Generated website content is returned to your ForgeAI workspace and may be stored with your project.</p></section>
          <section><h2 className="text-xl font-bold text-white">Payments</h2><p className="mt-2">When paid billing is enabled, payments are processed by Stripe. ForgeAI does not store your card number. Subscription events are used to maintain your ForgeAI plan status.</p></section>
          <section><h2 className="text-xl font-bold text-white">Your choices</h2><p className="mt-2">You can stop using the service, manage an active subscription through the billing portal, and request deletion of your ForgeAI account and stored project data by contacting the service owner.</p></section>
          <section><h2 className="text-xl font-bold text-white">Contact</h2><p className="mt-2">For privacy questions or deletion requests, contact the ForgeAI service owner through the contact method published with your ForgeAI deployment.</p></section>
        </div>
      </article>
    </main>
  );
}
