"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Crown, RefreshCw, Save, ShieldAlert } from "lucide-react";
import type { ManagedBusiness } from "@/lib/types";
import type { PlanId } from "@/lib/plans";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { now, uid } from "@/lib/utils";
import { Badge, Button, Card, Select } from "./ui";

type Row = ManagedBusiness & { createdBy?: string };
type Draft = { plan: PlanId; status: "active" | "revoked" };

export function FounderControl({ currentBusinessId }: { currentBusinessId?: string }) {
  const { data, setData } = useApp();
  const fallback = useMemo<Row[]>(
    () => [
      {
        id: currentBusinessId || "current",
        name: data.business.name,
        owner: data.business.email,
        plan: data.business.plan,
        status: "active",
        createdAt: now(),
      },
    ],
    [currentBusinessId, data.business.email, data.business.name, data.business.plan],
  );
  const [rows, setRows] = useState<Row[]>(fallback);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setRows(fallback);
      setDrafts(Object.fromEntries(fallback.map((row) => [row.id, { plan: row.plan, status: row.status }])));
      setLoading(false);
      return;
    }
    const { data: businesses, error: businessError } = await supabase
      .from("nilestock_businesses")
      .select("id,name,plan,status,created_at,created_by")
      .order("created_at", { ascending: false });
    if (businessError) {
      setError(businessError.message);
      setRows(fallback);
      setLoading(false);
      return;
    }
    const ownerIds = [...new Set((businesses || []).map((business) => business.created_by))];
    const { data: profiles } = ownerIds.length
      ? await supabase.from("nilestock_profiles").select("id,email").in("id", ownerIds)
      : { data: [] as { id: string; email: string }[] };
    const owners = new Map((profiles || []).map((profile) => [profile.id, profile.email]));
    const nextRows: Row[] = (businesses || []).map((business) => ({
      id: business.id,
      name: business.name,
      owner: owners.get(business.created_by) || "Owner account",
      plan: business.plan as PlanId,
      status: business.status as "active" | "revoked",
      createdAt: business.created_at,
      createdBy: business.created_by,
    }));
    setRows(nextRows.length ? nextRows : fallback);
    setDrafts(
      Object.fromEntries(
        (nextRows.length ? nextRows : fallback).map((row) => [
          row.id,
          { plan: row.plan, status: row.status },
        ]),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // The founder view intentionally refreshes only when the current business changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusinessId]);

  const save = async (row: Row) => {
    const draft = drafts[row.id] || { plan: row.plan, status: row.status };
    setSaving(row.id);
    setError("");
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (supabase && row.id !== "current") {
      const { error: updateError } = await supabase
        .from("nilestock_businesses")
        .update({ ...draft, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updateError) {
        setError(updateError.message);
        setSaving(null);
        return;
      }
    }
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, ...draft } : item)));
    setData((current) => ({
      ...current,
      business:
        row.id === currentBusinessId || row.id === "current"
          ? { ...current.business, plan: draft.plan }
          : current.business,
      managedBusinesses: rows.map((item) =>
        item.id === row.id ? { ...item, ...draft } : item,
      ),
      audit: [
        {
          id: uid(),
          actor: "Founder",
          action: "Business access saved",
          record: `${row.name} • ${draft.plan} • ${draft.status}`,
          createdAt: now(),
        },
        ...current.audit,
      ],
    }));
    setMessage(`${row.name} now has ${draft.plan.toUpperCase()} access.`);
    setSaving(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[radial-gradient(circle_at_85%_0%,rgba(255,193,73,.25),transparent_34%),linear-gradient(120deg,#101c18,#173c35_55%,#2e435f)] p-7 text-white shadow-[0_24px_70px_rgba(10,40,32,.2)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Crown className="text-amber-300" />
            <h2 className="mt-3 text-2xl font-semibold">Founder Control</h2>
            <p className="mt-1 text-sm text-white/60">Grant plans, save access and revoke businesses from the authoritative database.</p>
          </div>
          <Button
            variant="ghost"
            className="border border-white/25 bg-white/10 text-white hover:bg-white/20 dark:hover:bg-white/20"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh accounts
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FounderMetric label="Businesses" value={rows.length} />
        <FounderMetric label="Active" value={rows.filter((row) => (drafts[row.id]?.status || row.status) === "active").length} />
        <FounderMetric label="Pro" value={rows.filter((row) => (drafts[row.id]?.plan || row.plan) === "pro").length} />
      </div>
      {error ? (
        <p className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/45 dark:text-red-200">
          <ShieldAlert size={16} /> {error}
        </p>
      ) : null}
      {message ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200">
          <Check size={16} /> {message}
        </p>
      ) : null}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr>
              {["Business", "Owner", "Plan", "Status", "Save access"].map((label) => (
                <th className="px-4 py-3 text-xs text-muted" key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const draft = drafts[row.id] || { plan: row.plan, status: row.status };
              const dirty = draft.plan !== row.plan || draft.status !== row.status;
              return (
                <tr className="border-t border-line" key={row.id}>
                  <td className="px-4 py-4 font-semibold">{row.name}</td>
                  <td className="px-4 py-4">{row.owner}</td>
                  <td className="px-4 py-4">
                    <Select
                      className="w-36"
                      value={draft.plan}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.id]: { ...draft, plan: event.target.value as PlanId },
                        }))
                      }
                    >
                      <option value="free">Free</option>
                      <option value="starter">Lite</option>
                      <option value="business">Business</option>
                      <option value="pro">Pro</option>
                    </Select>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      className="rounded-full"
                      onClick={() =>
                        setDrafts((current) => ({
                          ...current,
                          [row.id]: {
                            ...draft,
                            status: draft.status === "active" ? "revoked" : "active",
                          },
                        }))
                      }
                    >
                      <Badge tone={draft.status === "active" ? "green" : "red"}>{draft.status}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <Button disabled={!dirty || saving === row.id} onClick={() => void save(row)}>
                      <Save size={15} /> {saving === row.id ? "Saving…" : "Save access"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function FounderMetric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <small className="text-muted">{label}</small>
      <b className="mt-3 block text-2xl">{value}</b>
    </Card>
  );
}
