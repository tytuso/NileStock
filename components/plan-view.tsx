"use client";

import { ArrowRight, Check, Crown, Lock, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  PLAN_ACCESS,
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  planLevel,
} from "@/lib/plans";
import { money } from "@/lib/utils";
import { Badge, Button, Card } from "./ui";

export function PlanView({ openBilling }: { openBilling: () => void }) {
  const { data } = useApp();
  const current = PLAN_DEFINITIONS[data.business.plan];
  const currentLevel = planLevel(data.business.plan);
  const next = PLAN_ORDER[currentLevel + 1];

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_0%,rgba(255,197,91,.23),transparent_35%),linear-gradient(120deg,#0a342a,#145765_55%,#3d4f82)] p-7 text-white shadow-[0_24px_70px_rgba(16,67,65,.22)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Crown className="text-amber-300" />
            <p className="mt-4 text-xs font-bold uppercase tracking-[.18em] text-white/60">Your current plan</p>
            <h2 className="mt-1 text-3xl font-semibold">{current.name}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">{current.summary}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
            <small className="text-white/60">Monthly value</small>
            <b className="block text-2xl">{current.price ? money(current.price) : "Free"}</b>
            <span className="mt-2 inline-flex items-center gap-2 text-xs text-emerald-200">
              <i className="h-2 w-2 rounded-full bg-emerald-400" /> Active
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <Card className="p-6">
          <h3 className="text-lg font-semibold">What your workspace can access</h3>
          <p className="mt-1 text-sm text-muted">Access is enforced by the plan saved on your NileStock business.</p>
          <div className="mt-5 space-y-2">
            {PLAN_ACCESS.map((feature) => {
              const unlocked = currentLevel >= planLevel(feature.minimum);
              return (
                <div className="flex items-center gap-3 rounded-xl border border-line p-3" key={feature.label}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${unlocked ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-50 text-red-600 dark:bg-red-950/45"}`}>
                    {unlocked ? <Check size={16} /> : <Lock size={15} />}
                  </span>
                  <span className="flex-1 text-sm font-medium">{feature.label}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${unlocked ? "text-emerald-700 dark:text-emerald-300" : "text-red-600"}`}>
                    {unlocked ? "Included" : feature.minimum}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="relative overflow-hidden p-6">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-200/35 blur-3xl dark:bg-sky-700/20" />
          <Sparkles className="relative text-indigo-600 dark:text-indigo-300" />
          <h3 className="relative mt-4 text-xl font-semibold">
            {next ? `What ${PLAN_DEFINITIONS[next].name} adds` : "You have every NileStock feature"}
          </h3>
          <p className="relative mt-2 text-sm leading-6 text-muted">
            {next ? PLAN_DEFINITIONS[next].summary : "Your Pro workspace includes AI advice, complete operational controls and report exports."}
          </p>
          <ul className="relative mt-5 space-y-3 text-sm">
            {(next ? PLAN_DEFINITIONS[next].features : PLAN_DEFINITIONS.pro.features).map((feature) => (
              <li className="flex gap-2" key={feature}>
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                  <Check size={12} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
          {next && (
            <Button className="relative mt-6 w-full" onClick={openBilling}>
              Compare and upgrade <ArrowRight size={16} />
            </Button>
          )}
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {PLAN_ORDER.map((id) => {
          const plan = PLAN_DEFINITIONS[id];
          const active = id === data.business.plan;
          return (
            <Card className={`p-5 ${active ? "border-emerald-500 ring-2 ring-emerald-500/15" : ""}`} key={id}>
              <div className="flex items-center justify-between gap-2">
                <b>{plan.name}</b>
                {active ? <Badge tone="green">Current</Badge> : null}
              </div>
              <p className="mt-2 min-h-10 text-xs leading-5 text-muted">{plan.copy}</p>
              <b className="mt-4 block text-xl">{plan.price ? money(plan.price) : "Free"}</b>
              <small className="text-muted">{plan.price ? "per month" : "forever"}</small>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
