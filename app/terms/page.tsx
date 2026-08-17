import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using NileStock retail software.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[#f8faf9] px-5 py-16 text-[#13231c]">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[#dce5e0] bg-white p-7 shadow-sm sm:p-10">
        <a href="/" className="text-sm font-semibold text-emerald-700">← Back to NileStock</a>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-emerald-700">NileStock</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-[#62736b]">Last updated: 17 August 2026</p>
        <div className="prose prose-slate mt-8 max-w-none space-y-5 text-sm leading-7 text-[#52645b] [&_a]:text-emerald-700 [&_h2]:pt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#13231c]">
        <h2>Use of the service</h2>
        <p>NileStock is business software for recording and managing retail operations. You are responsible for the accuracy of the products, prices, taxes, users and transactions entered into your workspace.</p>
        <h2>Subscriptions</h2>
        <p>Free and paid plans provide different product limits and features. Paid access is activated only after the applicable payment or billing request is verified.</p>
        <h2>Hardware</h2>
        <p>NileStock subscriptions cover software access unless a separate written offer states otherwise. Phones, computers, receipt printers, scanners, cash drawers and POS terminals are normally purchased separately.</p>
        <h2>Connectivity and backups</h2>
        <p>Offline-ready features depend on the app having been loaded and set up previously. Keep important business records backed up and reconnect periodically so pending data can synchronize.</p>
        <h2>Support</h2>
        <p>For account or service questions contact <a href="mailto:hello@nileai.solutions">hello@nileai.solutions</a>.</p>

        </div>
      </article>
    </main>
  );
}
