import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How NileStock handles account, business and device data.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[#f8faf9] px-5 py-16 text-[#13231c]">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[#dce5e0] bg-white p-7 shadow-sm sm:p-10">
        <a href="/" className="text-sm font-semibold text-emerald-700">← Back to NileStock</a>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-emerald-700">NileStock</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[#62736b]">Last updated: 17 August 2026</p>
        <div className="prose prose-slate mt-8 max-w-none space-y-5 text-sm leading-7 text-[#52645b] [&_a]:text-emerald-700 [&_h2]:pt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#13231c]">
        <h2>Information NileStock uses</h2>
        <p>NileStock processes account details, business settings, products, sales, stock movements, receipts and other records you enter so the service can operate.</p>
        <h2>Local and cloud storage</h2>
        <p>The app keeps local browser data to support fast and offline-ready operation. Signed-in cloud workspaces are also synchronized to the configured Supabase project when connectivity is available.</p>
        <h2>Payments and AI</h2>
        <p>Subscription payment processing is handled by the payment provider configured by NileStock. Pro AI requests may send a limited business context to the configured AI provider; customer contact details should not be included in AI prompts.</p>
        <h2>Your control</h2>
        <p>You can edit your business data in NileStock and contact support for account, access or deletion requests.</p>
        <h2>Contact</h2>
        <p>Email <a href="mailto:hello@nileai.solutions">hello@nileai.solutions</a> for privacy questions.</p>

        </div>
      </article>
    </main>
  );
}
