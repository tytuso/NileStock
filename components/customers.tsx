"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  History,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";
import { useApp } from "@/lib/store";
import type { AppData, Contact, CustomerAccountEntry, Sale } from "@/lib/types";
import {
  accountAmount,
  recordCustomerEntry,
  saveCustomerDetails,
} from "@/lib/customer-accounts";
import { can, day, fileSafeName, money, now, uid } from "@/lib/utils";
import { useDownloadFeedback } from "@/lib/use-download-feedback";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "./ui";
import { Receipt } from "./receipt";

type Dialog =
  | { type: "customer"; customerId?: string }
  | { type: "entry"; customerId: string; kind: CustomerAccountEntry["kind"] };
type AccountTab = "Activity" | "Purchases" | "Payments";
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "This record could not be saved. Please try again.";

export function Customers({
  onNewSale,
  actor,
}: {
  onNewSale: (customerId: string) => void;
  actor: string;
}) {
  const { data, setData, role } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [tab, setTab] = useState<AccountTab>("Activity");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState<"directory" | "statement" | null>(
    null,
  );
  const [exportError, setExportError] = useState("");
  const { markDownloaded, labelFor } = useDownloadFeedback();
  const currency = data.business.currency;
  const customer = data.customers.find((record) => record.id === selectedId);
  const canAddBalance = can(role, "opening-balance");

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const directory = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase();
    return data.customers
      .filter(
        (record) =>
          (!search ||
            `${record.name} ${record.phone} ${record.email || ""} ${record.address || ""}`
              .toLowerCase()
              .includes(search)) &&
          (filter === "all" ||
            (filter === "owing" ? record.balance > 0 : record.balance <= 0)),
      )
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "balance"
            ? b.balance - a.balance
            : (b.lastActivity || "").localeCompare(a.lastActivity || "") ||
              a.name.localeCompare(b.name),
      );
  }, [data.customers, deferredQuery, filter, sort]);
  const summary = useMemo(
    () =>
      data.customers.reduce(
        (result, record) => ({
          purchases: result.purchases + record.total,
          outstanding: result.outstanding + Math.max(0, record.balance),
          owing: result.owing + (record.balance > 0 ? 1 : 0),
        }),
        { purchases: 0, outstanding: 0, owing: 0 },
      ),
    [data.customers],
  );
  const customerSales = useMemo(
    () =>
      data.sales
        .filter((sale) => sale.customerId === selectedId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.sales, selectedId],
  );
  const customerEntries = useMemo(
    () =>
      (data.customerEntries || [])
        .filter((entry) => entry.customerId === selectedId)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [data.customerEntries, selectedId],
  );
  const payments = customerEntries.filter((entry) => entry.kind === "payment");
  const completedCount = customerSales.filter(
    (sale) => sale.status === "completed",
  ).length;
  const activity = useMemo(
    () =>
      [
        ...customerSales.map((sale) => ({
          id: sale.id,
          date: sale.createdAt.slice(0, 10),
          at: sale.createdAt,
          sale,
          entry: null,
        })),
        ...customerEntries.map((entry) => ({
          id: entry.id,
          date: entry.date,
          at: entry.createdAt,
          sale: null,
          entry,
        })),
      ].sort(
        (a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at),
      ),
    [customerSales, customerEntries],
  );

  const openCustomer = (id: string) => {
    setSelectedId(id);
    setTab("Activity");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const downloadPdf = async (kind: "directory" | "statement") => {
    if (exporting || (kind === "statement" && !customer)) return;
    setExporting(kind);
    setExportError("");
    try {
      const { createCustomerDirectoryPdf, createCustomerStatementPdf } =
        await import("@/lib/customer-pdf");
      const scope = `${filter === "owing" ? "Outstanding balances" : filter === "settled" ? "Settled accounts" : "All customers"}${deferredQuery.trim() ? ` | Search: ${deferredQuery.trim()}` : ""}`;
      const pdf =
        kind === "directory"
          ? createCustomerDirectoryPdf(data.business, directory, scope)
          : createCustomerStatementPdf(data, customer!.id);
      const filename =
        kind === "directory"
          ? `${fileSafeName(data.business.name)}-customers-${localDate()}.pdf`
          : `${fileSafeName(customer!.name)}-statement-${localDate()}.pdf`;
      pdf.save(filename);
      markDownloaded(kind);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "The PDF could not be downloaded. Please try again.",
      );
    } finally {
      setExporting(null);
    }
  };
  const save = (
    update: (current: AppData) => AppData,
    message: string,
    id?: string,
  ) => {
    setData(update);
    setDialog(null);
    if (id) setSelectedId(id);
    setNotice(message);
  };
  const entryCustomer =
    dialog?.type === "entry"
      ? data.customers.find((record) => record.id === dialog.customerId)
      : undefined;
  const editingCustomer =
    dialog?.type === "customer"
      ? data.customers.find((record) => record.id === dialog.customerId)
      : undefined;

  return (
    <div className="customer-workspace mx-auto max-w-[1440px] space-y-6 pb-6">
      {exportError && <FormError message={exportError} />}
      {customer ? (
        <>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Button
              variant="ghost"
              className="-ml-2 px-2"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft size={16} /> Customers
            </Button>
            <ChevronRight size={14} />
            <span className="truncate text-ink">Account</span>
          </div>
          <section className="relative overflow-hidden rounded-3xl bg-[#073f32] p-5 text-white shadow-[0_16px_48px_rgba(7,63,50,.13)] sm:p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-32 h-80 w-80 rounded-full border-[48px] border-white/[.04]"
            />
            <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 text-xl font-semibold sm:h-20 sm:w-20 sm:text-2xl">
                  {initials(customer.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-emerald-200/80">
                    Customer account
                  </p>
                  <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
                    {customer.name}
                  </h1>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-emerald-100/85">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${customer.balance > 0 ? "bg-amber-300" : "bg-emerald-300"}`}
                      />
                      {customer.balance > 0
                        ? "Has outstanding balance"
                        : customer.balance < 0
                          ? "Has account credit"
                          : "Account up to date"}
                    </span>
                    {customer.lastActivity && (
                      <>
                        <span aria-hidden>·</span>
                        <span>Last activity {day(customer.lastActivity)}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                  disabled={Boolean(exporting)}
                  onClick={() => void downloadPdf("statement")}
                  title="Download the complete customer statement"
                >
                  <Download size={15} />
                  {exporting === "statement"
                    ? "Preparing PDF…"
                    : labelFor("statement", "Statement PDF")}
                </Button>
                <Button
                  className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  onClick={() =>
                    setDialog({ type: "customer", customerId: customer.id })
                  }
                >
                  <Pencil size={15} /> Edit details
                </Button>
                <Button
                  className="bg-white text-[#073f32] hover:bg-emerald-50"
                  onClick={() => onNewSale(customer.id)}
                >
                  <Plus size={17} /> New sale
                </Button>
              </div>
            </div>
          </section>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <Metric
              icon={ShoppingBag}
              label="Total purchases"
              value={money(customer.total, currency)}
              detail={`${completedCount} completed ${completedCount === 1 ? "sale" : "sales"} on record`}
            />
            <Metric
              icon={Wallet}
              label={
                customer.balance < 0
                  ? "Credit available"
                  : "Outstanding balance"
              }
              value={money(Math.abs(customer.balance), currency)}
              detail={
                customer.balance > 0
                  ? "Amount this customer owes you"
                  : customer.balance < 0
                    ? "Credit held on this account"
                    : "All recorded balances are settled"
              }
              warning={customer.balance > 0}
            />
            <Metric
              icon={ArrowDownLeft}
              label="Payments recorded"
              value={money(
                payments.reduce((sum, entry) => sum + entry.amount, 0),
                currency,
              )}
              detail={`${payments.length} account payments in this history`}
            />
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
            <div className="space-y-5">
              <Card className="overflow-hidden rounded-2xl">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="text-sm font-semibold">Contact details</h2>
                  <Button
                    variant="ghost"
                    className="h-8 min-h-8 w-8 p-0"
                    aria-label="Edit contact details"
                    onClick={() =>
                      setDialog({ type: "customer", customerId: customer.id })
                    }
                  >
                    <Pencil size={14} />
                  </Button>
                </div>
                <div className="space-y-5 p-5">
                  <ContactLine
                    icon={Phone}
                    label="Phone"
                    value={customer.phone}
                    href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`}
                  />
                  <ContactLine
                    icon={Mail}
                    label="Email"
                    value={customer.email}
                    href={
                      customer.email ? `mailto:${customer.email}` : undefined
                    }
                  />
                  <ContactLine
                    icon={MapPin}
                    label="Address"
                    value={customer.address}
                  />
                  <div className="border-t border-line pt-4">
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
                      <FileText size={14} /> Notes
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">
                      {customer.notes ||
                        "Add a note about this customer in Edit details."}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="rounded-2xl p-5">
                <h2 className="text-sm font-semibold">Manage balance</h2>
                <p className="mb-4 mt-1 text-xs leading-5 text-muted">
                  Keep purchases, previous debts and payments together.
                </p>
                <Button
                  className="w-full"
                  disabled={customer.balance <= 0}
                  onClick={() =>
                    setDialog({
                      type: "entry",
                      customerId: customer.id,
                      kind: "payment",
                    })
                  }
                >
                  <ArrowDownLeft size={16} /> Record payment
                </Button>
                {canAddBalance && (
                  <Button
                    variant="secondary"
                    className="mt-2 w-full"
                    onClick={() =>
                      setDialog({
                        type: "entry",
                        customerId: customer.id,
                        kind: "opening_balance",
                      })
                    }
                  >
                    <History size={16} /> Add opening balance
                  </Button>
                )}
                <p className="mt-3 text-[11px] leading-5 text-muted">
                  Opening balances are debts from before NileStock. New
                  purchases go through New sale.
                </p>
              </Card>
            </div>
            <Card className="min-w-0 overflow-hidden rounded-2xl">
              <div className="border-b border-line px-4 pt-5 sm:px-6">
                <h2 className="font-semibold">Account history</h2>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Every purchase, opening balance and payment in one place.
                </p>
                <div
                  className="mt-4 flex gap-5"
                  role="tablist"
                  aria-label="Customer history"
                >
                  {(["Activity", "Purchases", "Payments"] as AccountTab[]).map(
                    (value) => (
                      <button
                        key={value}
                        id={`customer-tab-${value}`}
                        type="button"
                        role="tab"
                        tabIndex={tab === value ? 0 : -1}
                        aria-selected={tab === value}
                        aria-controls="customer-history"
                        onClick={() => setTab(value)}
                        onKeyDown={(event) => {
                          const tabs: AccountTab[] = [
                            "Activity",
                            "Purchases",
                            "Payments",
                          ];
                          const index = tabs.indexOf(value);
                          const next =
                            event.key === "ArrowRight"
                              ? (index + 1) % tabs.length
                              : event.key === "ArrowLeft"
                                ? (index + tabs.length - 1) % tabs.length
                                : event.key === "Home"
                                  ? 0
                                  : event.key === "End"
                                    ? tabs.length - 1
                                    : -1;
                          if (next < 0) return;
                          event.preventDefault();
                          setTab(tabs[next]);
                          event.currentTarget.parentElement
                            ?.querySelectorAll<HTMLButtonElement>(
                              '[role="tab"]',
                            )
                            [next]?.focus();
                        }}
                        className={`focusable -mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${tab === value ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}
                      >
                        {value}
                        <span className="ml-1.5 text-[11px] opacity-60">
                          {value === "Activity"
                            ? activity.length
                            : value === "Purchases"
                              ? customerSales.length
                              : payments.length}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div
                id="customer-history"
                role="tabpanel"
                aria-labelledby={`customer-tab-${tab}`}
                tabIndex={0}
                className="focusable min-h-64"
              >
                {tab === "Activity" &&
                  (activity.length ? (
                    <div className="divide-y divide-line">
                      {activity.map((item) =>
                        item.sale ? (
                          <SaleRow
                            key={`sale-${item.id}`}
                            sale={item.sale}
                            currency={currency}
                            onOpen={() => setReceipt(item.sale)}
                          />
                        ) : (
                          <EntryRow
                            key={`entry-${item.id}`}
                            entry={item.entry!}
                            currency={currency}
                          />
                        ),
                      )}
                    </div>
                  ) : (
                    <Empty
                      title="Your customer account is ready"
                      copy="Record a new sale, add an opening balance or receive a payment. Their history will appear here."
                      action={
                        <Button onClick={() => onNewSale(customer.id)}>
                          <Plus size={16} /> Create first sale
                        </Button>
                      }
                    />
                  ))}
                {tab === "Purchases" &&
                  (customerSales.length ? (
                    <div className="divide-y divide-line">
                      {customerSales.map((sale) => (
                        <SaleRow
                          key={sale.id}
                          sale={sale}
                          currency={currency}
                          onOpen={() => setReceipt(sale)}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="No purchases recorded yet"
                      copy="Use New sale to record items bought by this customer and keep their receipts here."
                      action={
                        <Button onClick={() => onNewSale(customer.id)}>
                          New sale <ArrowRight size={15} />
                        </Button>
                      }
                    />
                  ))}
                {tab === "Payments" &&
                  (payments.length ? (
                    <div className="divide-y divide-line">
                      {payments.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          currency={currency}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="No account payments recorded yet"
                      copy="Payments received against an outstanding balance will appear here with their date, method and reference."
                    />
                  ))}
              </div>
              <div className="flex items-start gap-2 border-t border-line bg-black/[.015] px-5 py-3 text-[11px] leading-5 text-muted dark:bg-white/[.02]">
                <Clock3 size={14} className="mt-0.5 shrink-0" />
                <span>
                  Existing totals and balances are preserved. Payments made
                  before this history was introduced remain included in the
                  account balance.
                </span>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-accent">
                Relationships, made simple
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Customer accounts
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted">
                Know what they bought, what they paid and what is still owing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <Button
                variant="secondary"
                className="rounded-xl"
                disabled={!directory.length || Boolean(exporting)}
                onClick={() => void downloadPdf("directory")}
                title={`Download the ${directory.length} customers in the current view`}
              >
                <Download size={16} />
                {exporting === "directory"
                  ? "Preparing PDF…"
                  : labelFor("directory", "Download PDF")}
              </Button>
              <Button
                className="rounded-xl px-5"
                onClick={() => setDialog({ type: "customer" })}
              >
                <Plus size={17} /> Add customer
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <Metric
              icon={Users}
              label="Customers"
              value={String(data.customers.length).padStart(2, "0")}
              detail="Your customer relationships"
            />
            <Metric
              icon={ShoppingBag}
              label="Total purchases"
              value={money(summary.purchases, currency)}
              detail="Purchases linked to customers"
            />
            <Metric
              icon={Wallet}
              label="Total outstanding"
              value={money(summary.outstanding, currency)}
              detail={`${summary.owing} ${summary.owing === 1 ? "customer has" : "customers have"} an open balance`}
              warning={summary.outstanding > 0}
            />
          </div>
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
            <label className="relative block xl:w-80">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-3.5 text-muted"
              />
              <Input
                aria-label="Search customers"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, phone or email…"
                className="rounded-xl bg-surface pl-10"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="inline-flex rounded-xl border border-line bg-surface p-1"
                aria-label="Filter customers"
              >
                {[
                  ["all", "All customers"],
                  ["owing", "Outstanding"],
                  ["settled", "Settled"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={`focusable rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${filter === value ? "bg-emerald-500/10 text-accent" : "text-muted hover:bg-black/5 dark:hover:bg-white/5"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Select
                aria-label="Sort customers"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="w-auto rounded-xl text-xs"
              >
                <option value="recent">Recent activity</option>
                <option value="name">Name A–Z</option>
                <option value="balance">Highest balance</option>
              </Select>
            </div>
          </div>
          {directory.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {directory.map((record) => (
                <Card
                  key={record.id}
                  className="group overflow-hidden rounded-2xl transition-shadow duration-200 hover:shadow-[0_8px_32px_rgba(7,63,50,.07)]"
                >
                  <button
                    type="button"
                    className="focusable block w-full p-5 text-left sm:p-6"
                    onClick={() => openCustomer(record.id)}
                    aria-label={`Open account for ${record.name}`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-sm font-semibold text-accent">
                        {initials(record.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-semibold">
                          {record.name}
                        </h2>
                        <p className="mt-1 truncate text-xs text-muted">
                          {record.phone}
                        </p>
                      </div>
                      <ChevronRight
                        size={17}
                        className="mt-1 text-muted transition-transform group-hover:translate-x-1"
                      />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-muted">
                          Total purchases
                        </p>
                        <p className="mt-1 break-words text-base font-semibold tabular">
                          {money(record.total, currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted">
                          {record.balance < 0
                            ? "Account credit"
                            : "Outstanding"}
                        </p>
                        <p
                          className={`mt-1 break-words text-base font-semibold tabular ${record.balance > 0 ? "text-amber-700 dark:text-amber-300" : "text-accent"}`}
                        >
                          {money(Math.abs(record.balance), currency)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <Badge tone={record.balance > 0 ? "amber" : "green"}>
                        {record.balance > 0
                          ? "Balance owing"
                          : record.balance < 0
                            ? "Credit available"
                            : "Up to date"}
                      </Badge>
                      <span className="text-[11px] text-muted">
                        View account
                      </span>
                    </div>
                  </button>
                  <div className="flex gap-2 border-t border-line bg-black/[.015] px-5 py-3 dark:bg-white/[.02] sm:px-6">
                    <Button
                      variant="ghost"
                      className="min-h-9 flex-1 px-2 text-xs"
                      onClick={() => onNewSale(record.id)}
                    >
                      <Plus size={14} /> New sale
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={record.balance <= 0}
                      className="min-h-9 flex-1 rounded-lg px-2 text-xs"
                      onClick={() =>
                        setDialog({
                          type: "entry",
                          customerId: record.id,
                          kind: "payment",
                        })
                      }
                    >
                      <ArrowDownLeft size={14} /> Record payment
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl border-dashed">
              <Empty
                title={
                  data.customers.length
                    ? "No customers match this view"
                    : "Make every customer a regular"
                }
                copy={
                  data.customers.length
                    ? "Try another name, phone number or balance filter."
                    : "Add your first customer to track their purchases, opening balance and payments."
                }
                action={
                  data.customers.length ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button onClick={() => setDialog({ type: "customer" })}>
                      <Plus size={16} /> Add first customer
                    </Button>
                  )
                }
              />
            </Card>
          )}
          {directory.length > 0 && (
            <p className="text-center text-xs text-muted">
              Showing {directory.length} of {data.customers.length} customers ·
              Open a customer to manage their account.
            </p>
          )}
        </>
      )}

      <Modal
        open={dialog?.type === "customer"}
        onClose={() => setDialog(null)}
        title={editingCustomer ? "Edit customer details" : "Add customer"}
      >
        {dialog?.type === "customer" && (
          <CustomerForm
            key={dialog.customerId || "new"}
            customer={editingCustomer}
            currency={currency}
            canAddBalance={canAddBalance}
            actor={actor}
            onSave={save}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>
      <Modal
        open={Boolean(entryCustomer)}
        onClose={() => setDialog(null)}
        title={
          dialog?.type === "entry" && dialog.kind === "payment"
            ? "Record customer payment"
            : "Add opening balance"
        }
      >
        {entryCustomer && dialog?.type === "entry" && (
          <AccountEntryForm
            key={`${entryCustomer.id}-${dialog.kind}`}
            customer={entryCustomer}
            kind={dialog.kind}
            currency={currency}
            actor={actor}
            onSave={save}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>
      <Modal
        wide
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title={receipt?.receiptNo || "Sale receipt"}
      >
        {receipt && <Receipt sale={receipt} />}
      </Modal>
      {notice && (
        <div
          role="status"
          className="customer-notice fixed bottom-5 left-4 right-4 z-[100] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-700/15 bg-[#073f32] px-5 py-4 text-sm text-white shadow-xl sm:left-auto sm:right-6"
        >
          <CheckCircle2 size={20} className="shrink-0 text-emerald-300" />
          {notice}
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  warning = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <Card className="flex items-start gap-3.5 rounded-2xl p-5">
      <div
        className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${warning ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-emerald-500/10 text-accent"}`}
      >
        <Icon size={19} strokeWidth={1.7} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p
          className={`mt-1.5 break-words text-xl font-semibold tracking-tight tabular sm:text-2xl ${warning ? "text-amber-700 dark:text-amber-300" : ""}`}
        >
          {value}
        </p>
        <p className="mt-1.5 text-[11px] leading-5 text-muted">{detail}</p>
      </div>
    </Card>
  );
}

function ContactLine({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value?: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-muted" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{label}</p>
        {href && value ? (
          <a
            href={href}
            className="focusable mt-1 block break-words text-sm hover:text-accent"
          >
            {value}
          </a>
        ) : (
          <p
            className={`mt-1 whitespace-pre-wrap break-words text-sm ${!value ? "text-muted" : ""}`}
          >
            {value || "Not added"}
          </p>
        )}
      </div>
    </div>
  );
}

function SaleRow({
  sale,
  currency,
  onOpen,
}: {
  sale: Sale;
  currency: string;
  onOpen: () => void;
}) {
  const onAccount = sale.payment === "Customer Credit";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="focusable flex w-full items-start gap-3 px-4 py-5 text-left transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03] sm:px-6"
      aria-label={`View receipt ${sale.receiptNo}`}
    >
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-accent">
        <ReceiptText size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{sale.receiptNo}</span>
          <Badge
            tone={
              sale.status !== "completed"
                ? "red"
                : onAccount
                  ? "amber"
                  : "green"
            }
          >
            {sale.status !== "completed"
              ? sale.status
              : onAccount
                ? "On account"
                : "Paid"}
          </Badge>
        </span>
        <span className="mt-1 block truncate text-xs leading-5 text-muted">
          {sale.items.map((item) => `${item.qty} × ${item.name}`).join(", ")}
        </span>
        <span className="mt-1 block text-[11px] leading-5 text-muted">
          {day(sale.createdAt)} · {sale.payment}
          {onAccount && sale.creditPaid
            ? ` · ${money(sale.creditPaid, currency)} paid at sale`
            : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={`block text-sm font-semibold tabular ${sale.status !== "completed" ? "text-muted line-through" : ""}`}
        >
          {money(sale.total, currency)}
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent">
          Receipt <ArrowUpRight size={12} />
        </span>
      </span>
    </button>
  );
}

function EntryRow({
  entry,
  currency,
}: {
  entry: CustomerAccountEntry;
  currency: string;
}) {
  const payment = entry.kind === "payment";
  return (
    <div className="flex items-start gap-3 px-4 py-5 sm:px-6">
      <span
        className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${payment ? "bg-emerald-500/10 text-accent" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
      >
        {payment ? <ArrowDownLeft size={18} /> : <History size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {payment ? "Payment received" : "Opening balance"}
        </p>
        <p className="mt-1 break-words text-xs leading-5 text-muted">
          {day(entry.date)}
          {entry.method ? ` · ${entry.method}` : ""}
          {entry.reference ? ` · ${entry.reference}` : ""}
        </p>
        {entry.notes && (
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">
            {entry.notes}
          </p>
        )}
        <p className="mt-1 text-[10px] text-muted">
          Recorded by {entry.createdBy}
        </p>
      </div>
      <span
        className={`shrink-0 text-right text-sm font-semibold tabular ${payment ? "text-accent" : "text-amber-700 dark:text-amber-300"}`}
      >
        {payment ? "−" : "+"}
        {money(entry.amount, currency)}
      </span>
    </div>
  );
}

type SaveAccount = (
  update: (current: AppData) => AppData,
  message: string,
  id?: string,
) => void;

function CustomerForm({
  customer,
  currency,
  canAddBalance,
  actor,
  onSave,
  onCancel,
}: {
  customer?: Contact;
  currency: string;
  canAddBalance: boolean;
  actor: string;
  onSave: SaveAccount;
  onCancel: () => void;
}) {
  const [hasBalance, setHasBalance] = useState(false);
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const fields = new FormData(event.currentTarget);
    const id = customer?.id || uid();
    const details = {
      id,
      name: String(fields.get("name") || ""),
      phone: String(fields.get("phone") || ""),
      email: String(fields.get("email") || ""),
      address: String(fields.get("address") || ""),
      notes: String(fields.get("notes") || ""),
    };
    const opening: CustomerAccountEntry | null =
      !customer && hasBalance && canAddBalance
        ? {
            id: uid(),
            customerId: id,
            kind: "opening_balance",
            amount: Number(fields.get("openingAmount")),
            date: String(fields.get("openingDate")),
            notes: "Balance brought forward when customer was added",
            createdAt: now(),
            createdBy: actor,
          }
        : null;
    try {
      onSave(
        (current) => {
          const next = saveCustomerDetails(current, details, actor);
          return opening ? recordCustomerEntry(next, opening) : next;
        },
        customer ? "Customer details updated" : "Customer account created",
        id,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        {customer
          ? "Keep their contact information and notes up to date."
          : "Create an account for their purchases, payments and any previous debt."}
      </p>
      <Field label="Customer name">
        <Input
          name="name"
          autoComplete="name"
          autoFocus
          required
          maxLength={120}
          defaultValue={customer?.name}
          placeholder="e.g. Sarah Nakato"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number">
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={40}
            defaultValue={customer?.phone}
            placeholder="e.g. 0772 123 456"
          />
        </Field>
        <Field label="Email (optional)">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={160}
            defaultValue={customer?.email}
            placeholder="customer@example.com"
          />
        </Field>
      </div>
      <Field label="Address (optional)">
        <Input
          name="address"
          autoComplete="street-address"
          maxLength={250}
          defaultValue={customer?.address}
          placeholder="Location or delivery address"
        />
      </Field>
      <Field label="Notes (optional)">
        <Textarea
          name="notes"
          maxLength={2000}
          defaultValue={customer?.notes}
          placeholder="Preferences, delivery instructions or other useful details"
        />
      </Field>
      {!customer && canAddBalance && (
        <div className="rounded-2xl border border-line p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={hasBalance}
              onChange={(event) => setHasBalance(event.target.checked)}
              className="h-4 w-4 accent-[#0d7a53]"
            />
            This customer already owes me
          </label>
          <p className="ml-7 mt-1 text-xs leading-5 text-muted">
            Bring forward a debt from before NileStock.
          </p>
          {hasBalance && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={`Opening balance (${currency})`}>
                <Input
                  name="openingAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                />
              </Field>
              <Field label="Balance date">
                <Input
                  name="openingDate"
                  type="date"
                  required
                  defaultValue={localDate()}
                  max={localDate()}
                />
              </Field>
            </div>
          )}
        </div>
      )}
      {error && <FormError message={error} />}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          <Check size={16} />
          {customer ? "Save changes" : "Create customer"}
        </Button>
      </div>
    </form>
  );
}

function AccountEntryForm({
  customer,
  kind,
  currency,
  actor,
  onSave,
  onCancel,
}: {
  customer: Contact;
  kind: CustomerAccountEntry["kind"];
  currency: string;
  actor: string;
  onSave: SaveAccount;
  onCancel: () => void;
}) {
  const payment = kind === "payment";
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const value = Number(amount) || 0;
  const nextBalance = accountAmount(
    customer.balance + (payment ? -value : value),
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const fields = new FormData(event.currentTarget);
    const entry: CustomerAccountEntry = {
      id: uid(),
      customerId: customer.id,
      kind,
      amount: Number(amount),
      date: String(fields.get("date")),
      method: payment
        ? (String(fields.get("method")) as CustomerAccountEntry["method"])
        : undefined,
      reference: String(fields.get("reference") || ""),
      notes: String(fields.get("notes") || ""),
      createdAt: now(),
      createdBy: actor,
    };
    try {
      onSave(
        (current) => recordCustomerEntry(current, entry),
        payment
          ? "Payment recorded. Balance updated."
          : "Opening balance added.",
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/5 p-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-sm font-semibold text-accent">
          {initials(customer.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{customer.name}</p>
          <p className="mt-1 text-xs text-muted">
            Current balance:{" "}
            <b className="text-ink">{money(customer.balance, currency)}</b>
          </p>
        </div>
      </div>
      {!payment && (
        <p className="text-sm leading-6 text-muted">
          Add an existing debt from before NileStock. This adds to the current
          balance and appears in their history. It does not create a sale or
          change stock.
        </p>
      )}
      <Field
        label={
          payment
            ? `Amount received (${currency})`
            : `Existing debt to add (${currency})`
        }
      >
        <Input
          name="amount"
          autoFocus
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          max={payment ? Math.max(0, customer.balance) : undefined}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
          placeholder="0.00"
          className="h-14 text-xl font-semibold tabular"
        />
      </Field>
      {payment && (
        <button
          type="button"
          onClick={() => setAmount(String(customer.balance))}
          className="focusable text-xs font-semibold text-accent"
        >
          Pay full balance · {money(customer.balance, currency)}
        </button>
      )}
      <div className={`grid gap-4 ${payment ? "sm:grid-cols-2" : ""}`}>
        <Field label={payment ? "Payment date" : "Balance date"}>
          <Input
            name="date"
            type="date"
            required
            defaultValue={localDate()}
            max={localDate()}
          />
        </Field>
        {payment && (
          <Field label="Payment method">
            <Select
              name="method"
              aria-label="Payment method"
              defaultValue="Cash"
            >
              <option>Cash</option>
              <option>Mobile Money</option>
              <option>Bank</option>
              <option>Card</option>
              <option>Other</option>
            </Select>
          </Field>
        )}
      </div>
      <Field label="Reference (optional)">
        <Input
          name="reference"
          maxLength={160}
          placeholder={
            payment
              ? "Transaction ID or receipt reference"
              : "e.g. Previous account book"
          }
        />
      </Field>
      <Field label="Notes (optional)">
        <Textarea
          name="notes"
          maxLength={2000}
          placeholder={
            payment
              ? "Anything to remember about this payment"
              : "What this previous debt relates to"
          }
        />
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm">
        <span className="text-muted">
          Balance after {payment ? "payment" : "entry"}
        </span>
        <b
          className={`tabular ${nextBalance < 0 ? "text-red-600" : "text-accent"}`}
        >
          {money(nextBalance, currency)}
        </b>
      </div>
      {error && <FormError message={error} />}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            !Number.isFinite(value) ||
            value <= 0 ||
            (payment && value > customer.balance)
          }
        >
          {payment ? <ArrowDownLeft size={16} /> : <Plus size={16} />}
          {payment ? "Save payment" : "Add opening balance"}
        </Button>
      </div>
    </form>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      {message}
    </p>
  );
}
