"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  Boxes,
  Lightbulb,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Target,
  Check,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { isProPlan } from "@/lib/plans";
import { cleanAdviserText } from "@/lib/ai-format";
import { Badge, Button, Card, Field, Textarea } from "./ui";
import { adviserMessages, ADVISER_INPUT_LENGTH, ADVISER_MESSAGE_LENGTH } from "@/lib/adviser-chat";
import { createBusinessInsights } from "@/lib/business-insights";
import { money, now, uid } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const suggestedPrompts = [
  "Give me today's 3 priorities to improve sales and protect profit.",
  "Compare this month with the same days last month. What changed and what should I do?",
  "Which products should I restock first, and why?",
  "Which items are tying up money without selling?",
  "Suggest an affordable promotion without sacrificing margin.",
  "Build a 7-day plan for repeat customers and more sales.",
];

const welcome: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "I’m your NileStock AI Business Manager. I can analyse your saved sales, product performance, expenses, stock and customer demand, then help you choose practical next steps. Tell me your goal or ask about a product or period. I’ll build on your answers as we work through a plan.",
};

function sanitizeChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [welcome];

  const cleaned = value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];

    const item = candidate as Partial<ChatMessage>;

    if (
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string"
    )
      return [];

    const content = (
      item.role === "assistant"
        ? cleanAdviserText(item.content)
        : item.content
    )
      .trim()
      .slice(0, ADVISER_MESSAGE_LENGTH);

    if (!content) return [];

    return [
      {
        id:
          typeof item.id === "string" && item.id
            ? item.id
            : crypto.randomUUID(),
        role: item.role,
        content,
      } satisfies ChatMessage,
    ];
  });

  return cleaned.length ? cleaned.slice(-40) : [welcome];
}

export function AiAdviser({ openBilling, businessId, signedInEmail }: { openBilling: () => void; businessId?: string; signedInEmail: string }) {
  const { data, setData, role, syncStatus, setSyncStatus } = useApp();
  const pro = isProPlan(data.business.plan);
  const storageKey = `nilestock.ai.chat.v2.${businessId || "local"}.${signedInEmail}`;
  const legacyKey = `nilestock.ai.chat.${data.business.email || data.business.name}`;
  const canMigrateLegacyChat = data.business.email.trim().toLowerCase() === signedInEmail.trim().toLowerCase();
  const [loadedKey, setLoadedKey] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [briefDraft, setBriefDraft] = useState("");
  const [briefEditing, setBriefEditing] = useState(false);
  const [briefSaved, setBriefSaved] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const insights = useMemo(() => createBusinessInsights(data, { timeZone }), [data, timeZone]);
  const month = useMemo(() => insights.report({ period: "thisMonth" }), [insights]);
  const canEditBrief = pro && (role === "owner" || role === "manager");
  const lowStock = useMemo(
    () => data.products.filter((product) => product.active !== false && product.stock <= product.reorder).length,
    [data.products],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) || (canMigrateLegacyChat ? localStorage.getItem(legacyKey) : null);
      setMessages(saved ? sanitizeChatMessages(JSON.parse(saved)) : [welcome]);
    } catch {
      setMessages([welcome]);
    }
    setLoadedKey(storageKey);
  }, [canMigrateLegacyChat, legacyKey, storageKey]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40))); } catch { /* Chat stays usable when browser storage is full. */ }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loadedKey, messages, storageKey]);

  const ask = async (question: string) => {
    const clean = question.trim().slice(0, ADVISER_INPUT_LENGTH);
    if (!clean || busy) return;
    if (!pro) {
      openBilling();
      return;
    }
    if (!navigator.onLine) {
      setError("Connect to the internet to ask your AI business manager. Your saved conversation stays on this device.");
      return;
    }
    if (["saving", "pending", "error"].includes(syncStatus)) {
      window.dispatchEvent(new CustomEvent("nilestock:sync-now"));
      setError("Your latest business changes still need to sync. Wait for syncing to finish, then ask again so the manager uses the right figures.");
      return;
    }
    setError("");
    setBusy(true);
    setInput("");
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: clean,
    };
    const assistantId = crypto.randomUUID();
    const outgoing = adviserMessages([...messages, userMessage].filter((message) => message.id !== "welcome"));
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    const controller = new AbortController();
    let firstAnswerTimer: ReturnType<typeof setTimeout> | undefined;
    const requestTimer = setTimeout(() => controller.abort(), 65_000);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (!session?.access_token) throw new Error("Sign in again to use NileStock AI.");
      firstAnswerTimer = setTimeout(() => controller.abort(), 45_000);
      const makeRequest = (accessToken: string) =>
        fetch("/api/ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ messages: outgoing, businessId, timeZone }),
          signal: controller.signal,
        });

      let response = await makeRequest(session.access_token);

      if (response.status === 401 && supabase) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        const freshToken = refreshed.session?.access_token;

        if (freshToken) {
          response = await makeRequest(freshToken);
        }
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "NileStock AI could not answer right now.");
      }
      if (!response.body) throw new Error("The AI response stream did not start.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value?.length && firstAnswerTimer) {
          clearTimeout(firstAnswerTimer);
          firstAnswerTimer = undefined;
        }
        answer += decoder.decode(value, { stream: true });
        const displayAnswer = cleanAdviserText(answer);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: displayAnswer }
              : message,
          ),
        );
      }
      if (!answer.trim()) throw new Error("The adviser did not return an answer. Please retry your question.");
    } catch (caught) {
      const message = controller.signal.aborted
        ? "The adviser could not finish in time. Retry with a more focused question."
        : caught instanceof Error
          ? caught.message
          : "NileStock AI failed.";
      setError(message);
      setMessages((current) => current.filter((item) => item.id !== assistantId && item.id !== userMessage.id));
      setInput(clean);
    } finally {
      if (firstAnswerTimer) clearTimeout(firstAnswerTimer);
      clearTimeout(requestTimer);
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(input);
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_10%,rgba(91,164,255,.35),transparent_32%),linear-gradient(120deg,#062e25,#124f5d_52%,#394d85)] p-7 text-white shadow-[0_24px_70px_rgba(16,67,65,.24)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12">
                <Sparkles size={22} />
              </span>
              <Badge tone="red">PRO</Badge>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.03em]">
              NileStock AI Business Manager
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">
              Turn your business records into practical decisions. Explore sales,
              profit, stock and customer demand, build a plan, and ask follow-up
              questions as your business grows.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={17} /> Knows your saved business records
            </div>
            <p className="mt-1 text-xs text-white/65">Contacts and private customer details are excluded.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Sales this month", money(month.totals.recordedSalesIncludingTax, data.business.currency)],
          ["Estimated operating profit", money(month.totals.estimatedOperatingProfit, data.business.currency)],
          ["Completed sales this month", month.totals.completedSales],
          ["Products needing stock", lowStock],
        ].map(([label, value]) => <Card key={String(label)} className="p-4"><span className="text-xs text-muted">{label}</span><b className="mt-1 block break-words text-lg">{value}</b></Card>)}
      </div>
      <p className="text-xs leading-5 text-muted">Sales include recorded sales tax. Estimated profit deducts this tax, historical item costs and recorded expenses; unrecorded costs may reduce actual profit.</p>
      {month.warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><b>Check your figures</b><p className="mt-1">{month.warnings.slice(0, 2).join(" ")}</p></div>}

      <div className="grid gap-4 xl:grid-cols-[1fr_310px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <b>Business conversation</b>
              <p className="text-xs text-muted">Ask a question, then work through the next steps together.</p>
            </div>
            <span className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <i className={`h-2 w-2 rounded-full ${busy || syncStatus === "saving" ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} /> {busy ? "Analysing…" : syncStatus === "saving" ? "Syncing…" : "Ready"}
            </span>
          </div>
          <div className="scrollbar h-[430px] space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_20%_0%,rgba(106,210,166,.08),transparent_35%)] p-5">
            {messages.map((message) => (
              <div
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                {message.role === "assistant" && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white">
                    <Bot size={16} />
                  </span>
                )}
                <div
                  className={`max-w-[82%] break-words whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-br-md bg-ink text-surface"
                      : "rounded-bl-md border border-line bg-surface shadow-sm"
                  }`}
                >
                  {(message.role === "assistant"
                    ? cleanAdviserText(message.content)
                    : message.content) || (
                    <span className="inline-flex items-center gap-1 py-2" role="status" aria-label="Checking your business records">
                      {[0, 1, 2].map((dot) => (
                        <i
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                          key={dot}
                        />
                      ))}
                    </span>
                  )}
                </div>
                {message.role === "user" && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                    <UserRound size={16} />
                  </span>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="relative border-t border-line p-4">
            {!pro && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-surface/82 px-4 backdrop-blur-[3px]">
                <Lock size={17} className="text-red-600" />
                <Button onClick={openBilling}>Upgrade to Pro to ask</Button>
              </div>
            )}
            {error && (
              <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/45 dark:text-red-200">
                {error}
              </p>
            )}
            <form className="flex items-end gap-2" onSubmit={submit}>
              <Textarea
                className="min-h-[54px] flex-1 resize-none"
                placeholder="Ask about sales, profit, a product or your next move…"
                aria-label="Question for your business manager"
                maxLength={ADVISER_INPUT_LENGTH}
                disabled={busy}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (input.trim()) void ask(input);
                  }
                }}
              />
              <Button className="h-[54px] w-[54px] p-0" disabled={busy || !input.trim()} aria-label="Send question">
                <ArrowUp size={19} />
              </Button>
            </form>
            <p className="mt-2 text-xs leading-5 text-muted">Advice uses your latest synced records. Chat is saved on this device. Review estimates before acting.</p>
            {messages.some((m) => m.role === "assistant" && m.id !== "welcome") && !busy && <div className="mt-3 flex flex-wrap gap-2" aria-label="Follow-up questions">
              {["What should I do first?", "Turn this into a 7-day plan.", "What should I measure?"].map((question) => <button type="button" key={question} onClick={() => void ask(question)} className="focusable rounded-full border border-line px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5">{question}</button>)}
            </div>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2"><Target size={18} className="text-accent" /><b>Your business brief</b></div>
            <p className="mt-2 text-xs leading-5 text-muted">Tell your manager what you sell, who you serve, your goals and your budget or constraints. Saved with your business for future questions.</p>
            <form className="mt-3 space-y-3" onSubmit={(event) => {
              event.preventDefault();
              if (!canEditBrief) return;
              const notes = (briefEditing ? briefDraft : data.business.adviserNotes || "").trim();
              setSyncStatus("saving");
              setData((current) => ({ ...current, business: { ...current.business, adviserNotes: notes }, audit: [{ id: uid(), actor: "Owner/manager", action: "AI business brief updated", record: "Business goals and context", createdAt: now() }, ...current.audit] }));
              setBriefEditing(false); setBriefSaved(true);
              window.dispatchEvent(new CustomEvent("nilestock:sync-now"));
            }}>
              <Field label="Business goals and context"><Textarea value={briefEditing ? briefDraft : data.business.adviserNotes || ""} maxLength={1500} disabled={!canEditBrief} placeholder="Example: A neighbourhood cosmetics shop. Grow repeat sales with a small promotion budget; avoid tying up cash in slow stock." className="min-h-32" onChange={(event) => { setBriefDraft(event.target.value); setBriefEditing(true); setBriefSaved(false); }} /></Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={!canEditBrief || !briefEditing}>Save business brief</Button>
              {briefSaved && <p role="status" className="flex items-start gap-1 text-xs text-muted"><Check size={14} className="shrink-0" />{syncStatus === "synced" ? "Business brief saved and synced." : syncStatus === "error" ? "Saved on this device. Reconnect and sync before asking about the new brief." : "Business brief saved on this device; syncing when connected."}</p>}
            </form>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Lightbulb size={18} className="text-amber-600" />
              <b>Start with a useful question</b>
            </div>
            <div className="mt-4 space-y-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  className="w-full rounded-xl border border-line p-3 text-left text-sm transition hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/35"
                  key={prompt}
                  disabled={busy}
                  onClick={() => void ask(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <b>Context connected</b>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ContextStat icon={Boxes} label="Products" value={data.products.length} />
              <ContextStat icon={TrendingUp} label="Sales" value={data.sales.length} />
              <ContextStat icon={Lock} label="Low stock" value={lowStock} />
              <ContextStat icon={Sparkles} label="Daily AI" value="50" />
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">
              Your manager can look up every product and custom date range, compare periods, explore margins and test pricing ideas. It gives advice and drafts; you choose and carry out business actions.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContextStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-black/[.035] p-3 dark:bg-white/[.05]">
      <Icon size={15} className="text-emerald-700 dark:text-emerald-300" />
      <b className="mt-2 block text-lg">{value}</b>
      <small className="text-muted">{label}</small>
    </div>
  );
}
