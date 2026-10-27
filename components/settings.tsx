"use client";
import { useEffect, useState } from "react";
import { Check, CloudOff, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { can, now, uid } from "@/lib/utils";
import type { Business } from "@/lib/types";
import { Button, Card, Field, Input, Select, Textarea } from "./ui";

export function SettingsView() {
  const { data, setData, role, syncStatus, setSyncStatus } = useApp();
  const [showFeedback, setShowFeedback] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [validationError, setValidationError] = useState("");
  const saving = showFeedback && syncStatus === "saving";
  const nameConflict = showFeedback && syncStatus === "synced" &&
    submittedName !== data.business.name;
  const failed = Boolean(validationError) || syncStatus === "error" || nameConflict;
  const saved = !failed && (syncStatus === "synced" || syncStatus === "local");
  useEffect(() => {
    if (!showFeedback || !saved) return;
    const timeout = setTimeout(() => setShowFeedback(false), 5000);
    return () => clearTimeout(timeout);
  }, [saved, showFeedback]);
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!can(role, "settings") || saving) return;
            const fd = new FormData(event.currentTarget);
            const name = String(fd.get("name") || "").trim();
            if (!name) {
              setValidationError("Enter a business name before saving.");
              setShowFeedback(true);
              return;
            }
            setValidationError("");
            setSubmittedName(name);
            setShowFeedback(true);
            setSyncStatus("saving");
            setData((d) => ({
              ...d,
              business: {
                ...d.business,
                name,
                phone: String(fd.get("phone")).trim(),
                email: String(fd.get("email")).trim(),
                address: String(fd.get("address")).trim(),
                country: String(fd.get("country")).trim(),
                currency: String(fd.get("currency")),
                taxEnabled: fd.get("taxEnabled") === "on",
                taxRate: +String(fd.get("taxRate")),
                lowStockThreshold: +String(fd.get("lowStockThreshold") || 2),
                receiptFooter: String(fd.get("footer")),
                paper: String(fd.get("paper")) as Business["paper"],
                theme: String(fd.get("theme")) as Business["theme"],
              },
              products: d.products.map((p) => ({
                ...p,
                reorder: +String(fd.get("lowStockThreshold") || 2),
              })),
              audit: [
                {
                  id: uid(),
                  actor: "Owner",
                  action: "Settings changed",
                  record: "Business settings",
                  createdAt: now(),
                },
                ...d.audit,
              ],
            }));
            window.dispatchEvent(new CustomEvent("nilestock:sync-now"));
          }}
          onChange={() => { setShowFeedback(false); setValidationError(""); }}
          aria-busy={saving}
        >
          <fieldset disabled={!can(role, "settings") || saving} className="grid min-w-0 gap-5">
            <div>
              <h2 className="font-semibold">Business profile</h2>
              <p className="text-sm text-muted">
                Details used across receipts and reports.
              </p>
            </div>
            <Field label="Business name">
              <Input name="name" defaultValue={data.business.name} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone">
                <Input name="phone" defaultValue={data.business.phone} />
              </Field>
              <Field label="Email">
                <Input
                  name="email"
                  type="email"
                  defaultValue={data.business.email}
                />
              </Field>
              <Field label="Country">
                <Input name="country" defaultValue={data.business.country} />
              </Field>
              <Field label="Currency">
                <Select name="currency" defaultValue={data.business.currency}>
                  {["UGX", "KES", "TZS", "RWF", "USD"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Address">
              <Input name="address" defaultValue={data.business.address} />
            </Field>
            <Field label="Automatic low-stock alert level">
              <Input
                name="lowStockThreshold"
                type="number"
                min="0"
                defaultValue={data.business.lowStockThreshold ?? 2}
              />
              <span className="text-xs font-normal text-muted">
                Products at this quantity or below appear in alerts. Saving
                applies this level to all current products.
              </span>
            </Field>
            <hr className="border-line" />
            <h2 className="font-semibold">Sales & receipts</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="taxEnabled"
                type="checkbox"
                defaultChecked={data.business.taxEnabled}
              />{" "}
              Enable tax
            </label>
            <Field label="Tax rate %">
              <Input
                name="taxRate"
                type="number"
                min="0"
                max="100"
                defaultValue={data.business.taxRate}
              />
            </Field>
            <Field label="Receipt footer">
              <Textarea
                name="footer"
                defaultValue={data.business.receiptFooter}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Receipt paper">
                <Select name="paper" defaultValue={data.business.paper}>
                  <option>58mm</option>
                  <option>80mm</option>
                  <option>A4</option>
                </Select>
                <span className="text-xs font-normal text-muted">
                  Changes the receipt preview, downloaded PDF and print width.
                </span>
                <a href="/printing" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent underline">
                  Set up a phone or desktop printer
                </a>
              </Field>
              <Field label="Appearance">
                <Select name="theme" defaultValue={data.business.theme}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </Select>
              </Field>
            </div>
            <Button type="submit" disabled={!can(role, "settings") || saving}>
              {saving ? (
                <><span className="animate-spin motion-reduce:animate-none" aria-hidden="true"><LoaderCircle size={18} /></span>Saving settings…</>
              ) : showFeedback && saved ? <><Check size={18} aria-hidden="true" />Settings saved</> : "Save settings"}
            </Button>
          </fieldset>
          {!can(role, "settings") && <p className="mt-3 text-sm text-muted">Only the business owner can change these settings.</p>}
        </form>
      </Card>
      {showFeedback && (
        <div role={failed ? "alert" : "status"} aria-live={failed ? "assertive" : "polite"} aria-atomic="true"
          className={`settings-save-notice fixed bottom-5 left-4 right-4 z-[80] flex items-start gap-3 rounded-2xl border bg-surface p-4 shadow-xl sm:left-auto sm:w-96 ${failed ? "border-red-300 dark:border-red-800" : saved ? "border-emerald-300 dark:border-emerald-800" : "border-line"}`}>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${failed ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : saved ? "settings-save-success bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-black/5 text-muted dark:bg-white/10"}`} aria-hidden="true">
            {failed ? <TriangleAlert size={22} /> : saved ? <Check className="settings-save-check" size={23} /> : syncStatus === "pending" ? <CloudOff size={22} /> : <span className="animate-spin motion-reduce:animate-none"><LoaderCircle size={22} /></span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{failed ? "Settings need attention" : saved ? "Settings saved" : syncStatus === "pending" ? "Waiting to sync" : "Saving your settings…"}</p>
            <p className="mt-1 text-sm leading-5 text-muted">{validationError || (nameConflict ? "Another device changed the business name. Review it and save again." : syncStatus === "error" ? "The cloud save could not be confirmed. Check your connection and press Save settings to retry." : syncStatus === "pending" ? "Your changes are on this device. Reconnect and keep the app open to finish syncing." : syncStatus === "synced" ? "Your business details are saved and synced across devices." : syncStatus === "local" ? "Your business details are saved on this device." : "Please wait while we confirm the save.")}</p>
          </div>
          {!saving && <button type="button" className="focusable rounded p-1 text-muted" onClick={() => setShowFeedback(false)} aria-label="Dismiss save notification"><X size={16} /></button>}
        </div>
      )}
    </div>
  );
}
