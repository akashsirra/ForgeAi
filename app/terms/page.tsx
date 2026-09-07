export const metadata = {
  title: "Terms — ForgeAI",
  description: "ForgeAI terms of service.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-12 text-zinc-100 sm:px-8">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm text-zinc-400 hover:text-white">← Back to ForgeAI</a>
        <h1 className="mt-8 text-4xl font-black tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: September 7, 2026</p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-zinc-300">
          <section><h2 className="text-xl font-bold text-white">Using ForgeAI</h2><p className="mt-2">You may use ForgeAI to create and publish websites that you have the right to create and publish. You are responsible for the content, trademarks, images, links, code, and claims contained in websites you generate.</p></section>
          <section><h2 className="text-xl font-bold text-white">Acceptable use</h2><p className="mt-2">Do not use ForgeAI to distribute malware, phishing pages, illegal content, deceptive impersonation, abusive automation, or material that violates another person&apos;s rights or applicable law. We may suspend deployments that create a security or legal risk.</p></section>
          <section><h2 className="text-xl font-bold text-white">AI-generated content</h2><p className="mt-2">AI output can contain mistakes. Review generated websites before publishing and verify important claims, pricing, legal language, accessibility, and third-party assets.</p></section>
          <section><h2 className="text-xl font-bold text-white">Subscriptions</h2><p className="mt-2">ForgeAI Pro is a recurring subscription when paid billing is enabled. Prices and included features are shown at checkout. Stripe handles payment processing and subscription management.</p></section>
          <section><h2 className="text-xl font-bold text-white">Service availability</h2><p className="mt-2">We aim to keep ForgeAI available and reliable, but third-party AI, hosting, authentication, and payment services can fail or change. We do not guarantee uninterrupted availability.</p></section>
          <section><h2 className="text-xl font-bold text-white">Contact</h2><p className="mt-2">Questions about these terms can be directed to the ForgeAI service owner through the contact method published with your ForgeAI deployment.</p></section>
        </div>
      </article>
    </main>
  );
}
