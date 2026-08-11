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
} from "lucide-react";
import { useApp } from "@/lib/store";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { isProPlan } from "@/lib/plans";
import { cleanAdviserText } from "@/lib/ai-format";
import { Badge, Button, Card, Textarea } from "./ui";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const suggestedPrompts = [
  "Evaluate my business performance",
  "What should my next strategy be?",
  "Which products should I add?",
  "Where could I be losing profit?",
  "Which stock needs attention first?",
];

const welcome: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "I’m your NileStock AI Business Adviser. I use your latest products, sales, expenses, stock and customer requests to give practical answers. What would you like to improve first?",
};

export function AiAdviser({ openBilling }: { openBilling: () => void }) {
  const { data } = useApp();
  const pro = isProPlan(data.business.plan);
  const storageKey = `nilestock.ai.chat.${data.business.email || data.business.name}`;
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lowStock = useMemo(
    () => data.products.filter((product) => product.stock <= product.reorder).length,
    [data.products],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved)
        setMessages(
          (JSON.parse(saved) as ChatMessage[]).map((message) => ({
            ...message,
            content:
              message.role === "assistant"
                ? cleanAdviserText(message.content)
                : message.content,
          })),
        );
    } catch {
      setMessages([welcome]);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, storageKey]);

  const ask = async (question: string) => {
    const clean = question.trim();
    if (!clean || busy) return;
    if (!pro) {
      openBilling();
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
    const outgoing = [...messages, userMessage]
      .filter((message) => message.id !== "welcome")
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    const controller = new AbortController();
    let firstAnswerTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (!session?.access_token) throw new Error("Sign in again to use NileStock AI.");
      firstAnswerTimer = setTimeout(() => controller.abort(), 20_000);
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: outgoing }),
        signal: controller.signal,
      });
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
    } catch (caught) {
      const message = controller.signal.aborted
        ? "The adviser took too long to start. Please retry—the request was stopped so you are not left waiting."
        : caught instanceof Error
          ? caught.message
          : "NileStock AI failed.";
      setError(message);
      setMessages((current) => current.filter((item) => item.id !== assistantId));
    } finally {
      if (firstAnswerTimer) clearTimeout(firstAnswerTimer);
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
              NileStock AI Business Adviser
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">
              Ask questions in plain language. Your adviser evaluates current
              sales, products, stock, expenses and demand signals before it answers.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={17} /> Live business context
            </div>
            <p className="mt-1 text-xs text-white/65">Contacts and private customer details are excluded.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_310px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <b>Business conversation</b>
              <p className="text-xs text-muted">Answers stay grounded in your NileStock records.</p>
            </div>
            <span className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <i className="h-2 w-2 rounded-full bg-emerald-500" /> Ready
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
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-br-md bg-ink text-surface"
                      : "rounded-bl-md border border-line bg-surface shadow-sm"
                  }`}
                >
                  {(message.role === "assistant"
                    ? cleanAdviserText(message.content)
                    : message.content) || (
                    <span className="inline-flex gap-1 py-2">
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
              <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/45 dark:text-red-200">
                {error}
              </p>
            )}
            <form className="flex items-end gap-2" onSubmit={submit}>
              <Textarea
                className="min-h-[54px] flex-1 resize-none"
                placeholder="Ask about strategy, products, stock or profit…"
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
          </div>
        </Card>

        <div className="space-y-4">
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
              NileStock refreshes the business summary for every question, so the adviser follows your latest records.
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
