"use client";

export default function VasthuHouseDemo() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#20231f]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f7f4ee]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-lg font-bold tracking-tight">Vasthu House</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#7a776e]">No Demolition • Practical Consultation</div>
          </div>
          <a href="https://wa.me/919949588017" className="rounded-full bg-[#1f5d45] px-4 py-2 text-sm font-semibold text-white">WhatsApp Consultation</a>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-20">
        <div>
          <span className="inline-flex rounded-full border border-[#1f5d45]/20 bg-[#1f5d45]/5 px-3 py-1 text-xs font-semibold text-[#1f5d45]">Hyderabad • Online • Worldwide</span>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl">Practical Vasthu guidance for the space you live and work in.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#626057] sm:text-lg">Residential, commercial and industrial Vasthu consultation with a practical, no-demolition approach.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="https://wa.me/919949588017" className="rounded-xl bg-[#1f5d45] px-6 py-3.5 text-center font-bold text-white shadow-lg shadow-[#1f5d45]/15">Book a Consultation →</a>
            <a href="#services" className="rounded-xl border border-black/10 bg-white px-6 py-3.5 text-center font-semibold">Explore Services</a>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-center text-xs text-[#68665e]">
            <div className="rounded-xl border border-black/10 bg-white/60 p-3"><b className="block text-sm text-[#20231f]">2014+</b>Experience</div>
            <div className="rounded-xl border border-black/10 bg-white/60 p-3"><b className="block text-sm text-[#20231f]">Online</b>Worldwide</div>
            <div className="rounded-xl border border-black/10 bg-white/60 p-3"><b className="block text-sm text-[#20231f]">No</b>Demolition</div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-[#1f5d45] p-3 shadow-2xl">
          <div className="rounded-[1.6rem] bg-[#e8e0d1] p-8 sm:p-10">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#1f5d45]">Consultation</div>
            <h2 className="mt-3 text-3xl font-black">Get clarity before you make your next move.</h2>
            <p className="mt-4 leading-7 text-[#625f56]">Discuss your home, office, plot or property with the Vasthu House team.</p>
            <div className="mt-7 rounded-2xl bg-white p-5">
              <div className="text-sm text-[#77746b]">Property Vasthu Check</div>
              <div className="mt-1 text-2xl font-black">From ₹5,100</div>
              <div className="mt-1 text-xs text-[#77746b]">Consultation pricing can be confirmed with the team.</div>
            </div>
            <a href="https://wa.me/919949588017" className="mt-4 block rounded-xl bg-[#20231f] px-5 py-3 text-center font-bold text-white">Chat on WhatsApp</a>
          </div>
        </div>
      </section>

      <section id="services" className="border-y border-black/10 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#1f5d45]">Services</div>
            <h2 className="mt-3 text-4xl font-black tracking-tight">One place for your Vasthu consultation needs.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Residential", "Home and apartment Vasthu guidance."],
              ["Commercial", "Office and business space consultation."],
              ["Industrial", "Industrial site and workplace guidance."],
              ["Online", "Consult remotely from anywhere in the world."],
            ].map(([title, text]) => (
              <article key={title} className="rounded-2xl border border-black/10 bg-[#faf9f6] p-6">
                <div className="text-2xl">✦</div>
                <h3 className="mt-5 font-bold">{title} Vasthu</h3>
                <p className="mt-2 text-sm leading-6 text-[#6a685f]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-[2rem] bg-[#20231f] p-8 text-white sm:p-12">
          <div className="max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8d6c7]">Why Vasthu House</div>
            <h2 className="mt-3 text-4xl font-black">A clearer digital path from visitor to consultation.</h2>
            <p className="mt-5 leading-7 text-white/65">This demo is designed around the services you already offer: clear service choices, consultation information and a direct WhatsApp action for visitors.</p>
            <a href="https://wa.me/919949588017" className="mt-7 inline-block rounded-xl bg-white px-6 py-3.5 font-bold text-black">Start a Conversation →</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/10 px-5 py-8 text-center text-xs text-[#77746b]">
        Vasthu House • Hyderabad, Telangana • Online consultations available
      </footer>
    </main>
  );
}
