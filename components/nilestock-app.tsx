"use client";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Bot,
  Box,
  Boxes,
  ChevronRight,
  Check,
  ClipboardCheck,
  CircleDollarSign,
  CreditCard,
  Crown,
  Download,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  PackagePlus,
  PanelLeftClose,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  SunMoon,
  Truck,
  Upload,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useApp } from "@/lib/store";
import {
  Contact,
  PaymentMethod,
  Product,
  Sale,
  Staff,
} from "@/lib/types";
import {
  can,
  csv,
  day,
  download,
  fileSafeName,
  money,
  now,
  uid,
} from "@/lib/utils";
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
import { POS } from "./pos";
import { CodeCatalogue } from "./codes";
import { Receipt } from "./receipt";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  hasMinimumPlan,
  isProPlan,
  receiptHistoryLimit,
} from "@/lib/plans";
import {
  REPORT_KINDS,
  buildReportSnapshot,
  type ReportKind,
  type ReportSnapshot,
} from "@/lib/reports";
import { createBrandedReportPdf } from "@/lib/report-pdf";
import { AiAdviser } from "./ai-adviser";
import { FounderControl } from "./founder-control";
import { PlanView } from "./plan-view";
import { useDownloadFeedback } from "@/lib/use-download-feedback";
import { shouldUseDarkTheme } from "@/lib/theme";
type Page =
  | "Overview"
  | "Sale"
  | "Products"
  | "Codes"
  | "AI Adviser"
  | "Import Products"
  | "Inventory"
  | "Sales"
  | "Receipts"
  | "Purchases"
  | "Suppliers"
  | "Customers"
  | "Customer Requests"
  | "Expenses"
  | "Reports"
  | "PDF Reports"
  | "Staff"
  | "Audit Log"
  | "Settings"
  | "Billing"
  | "Plan"
  | "Help"
  | "Founder";
const nav: [Page, any][] = [
  ["Overview", LayoutDashboard],
  ["Sale", ShoppingBag],
  ["Products", Box],
  ["Codes", CreditCard],
  ["AI Adviser", Bot],
  ["Inventory", Boxes],
  ["Sales", ReceiptText],
  ["Receipts", Archive],
  ["Customer Requests", ClipboardCheck],
  ["Expenses", WalletCards],
  ["Reports", BarChart3],
  ["PDF Reports", FileText],
  ["Staff", Users],
  ["Audit Log", Activity],
  ["Settings", Settings],
  ["Plan", Crown],
  ["Billing", CircleDollarSign],
  ["Purchases", PackagePlus],
  ["Suppliers", Truck],
  ["Customers", Users],
  ["Help", HelpCircle],
  ["Founder", Crown],
];
const validPages = new Set<Page>([
  ...nav.map(([page]) => page),
  "Import Products",
]);
export function NileStockApp({
  session,
  signOut,
}: {
  session: {
    email: string;
    name: string;
    founder: boolean;
    businessId?: string;
    cloud?: boolean;
  };
  signOut: () => void;
}) {
  const { data, ready, role, setData, setRole } = useApp();
  const [page, setPage] = useState<Page>("Overview"),
    [pageReady, setPageReady] = useState(false),
    [mobile, setMobile] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [search, setSearch] = useState(false),
    [installPrompt, setInstallPrompt] = useState<any>(null);
  const pageKey = `nilestock.active-page.${session.email.toLowerCase()}`;
  const initials = session.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  useEffect(() => {
    const stored = localStorage.getItem(pageKey) as Page | null;
    if (
      stored &&
      validPages.has(stored) &&
      (stored !== "Founder" || session.founder)
    )
      setPage(stored);
    setPageReady(true);
  }, [pageKey, session.founder]);
  useEffect(() => {
    if (pageReady) localStorage.setItem(pageKey, page);
  }, [page, pageKey, pageReady]);
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    addEventListener("beforeinstallprompt", capture);
    return () => removeEventListener("beforeinstallprompt", capture);
  }, []);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      shouldUseDarkTheme(
        data.business.theme,
        matchMedia("(prefers-color-scheme:dark)").matches,
      ),
    );
  }, [data.business.theme]);
  const toggleTheme = () =>
    setData((current) => ({
      ...current,
      business: {
        ...current.business,
        theme: document.documentElement.classList.contains("dark")
          ? "light"
          : "dark",
      },
    }));
  if (!ready || !pageReady)
    return (
      <div className="grid h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_78%_8%,rgba(126,199,255,.18),transparent_30%),radial-gradient(circle_at_20%_88%,rgba(57,196,137,.11),transparent_28%),#f6f5ef] text-ink dark:bg-[radial-gradient(circle_at_78%_8%,rgba(61,132,186,.20),transparent_32%),radial-gradient(circle_at_18%_88%,rgba(45,169,132,.10),transparent_28%),#071426]">
      {mobile && (
        <button
          className="fixed inset-0 z-40 bg-[#06101e]/55 backdrop-blur-[1px] lg:hidden"
          aria-label="Close navigation menu"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`${mobile ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0 ${collapsed ? "lg:w-[74px]" : ""}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-line px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent font-bold text-white">
            N
          </div>
          {!collapsed && (
            <div>
              <b>NileStock</b>
              <span className="block text-[10px] uppercase tracking-wider text-muted">
                Retail OS
              </span>
            </div>
          )}
          <button
            className="ml-auto lg:hidden"
            onClick={() => setMobile(false)}
            aria-label="Close navigation menu"
          >
            <X />
          </button>
        </div>
        <nav className="scrollbar flex-1 overflow-y-auto p-2">
          {nav
            .filter(([n]) => n !== "Founder" || session.founder)
            .map(([n, I]) => {
              const aiLocked =
                n === "AI Adviser" && !isProPlan(data.business.plan);
              const reportLocked =
                n === "PDF Reports" &&
                !hasMinimumPlan(data.business.plan, "business");
              const locked = aiLocked || reportLocked;
              return (
                <button
                  key={n}
                  title={n}
                  onClick={() => {
                    setPage(n);
                    setMobile(false);
                  }}
                  className={`focusable mb-1 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium ${page === n ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "text-muted hover:bg-black/5 dark:hover:bg-white/5"}`}
                >
                  <I size={18} />
                  {!collapsed && n}
                  {!collapsed && locked && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                      <Lock size={11} /> {aiLocked ? "PRO" : "BUSINESS"}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-xs font-bold dark:bg-white/10">
              {initials || "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <b className="block truncate text-xs">{session.name}</b>
                <select
                  className="bg-transparent text-[10px] text-muted"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                >
                  <option value="owner">Owner view</option>
                  <option value="manager">Manager view</option>
                  <option value="cashier">Cashier view</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </aside>
      <div
        className={`transition-all ${collapsed ? "lg:pl-[74px]" : "lg:pl-64"}`}
      >
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-[linear-gradient(100deg,rgba(238,252,246,.96),rgba(239,248,255,.96),rgba(246,244,255,.96))] px-4 backdrop-blur dark:bg-[linear-gradient(100deg,rgba(13,43,32,.96),rgba(15,35,49,.96),rgba(29,27,48,.96))] lg:px-7">
          <button
            className="lg:hidden"
            onClick={() => setMobile(true)}
            aria-label="Open navigation menu"
          >
            <Menu />
          </button>
          <button
            className="hidden lg:block"
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeftClose size={19} />
          </button>
          <div>
            <h1 className="font-semibold">{page}</h1>
            <p className="hidden text-[11px] text-muted sm:block">
              {data.business.name}
            </p>
          </div>
          <div className="ml-auto flex gap-1">
            <Button
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={() => setSearch(true)}
              aria-label="Search"
            >
              <Search size={18} />
            </Button>
            <Button
              variant="ghost"
              className="relative h-9 w-9 p-0"
              onClick={() => setPage("Inventory")}
            >
              <Bell size={18} />
              {data.products.some((p) => p.stock <= p.reorder) && (
                <i className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Button>
            <Button
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              <SunMoon size={18} />
            </Button>
            {installPrompt && (
              <Button
                variant="secondary"
                className="hidden sm:flex"
                onClick={async () => {
                  await installPrompt.prompt();
                  setInstallPrompt(null);
                }}
              >
                Install app
              </Button>
            )}
            <Button
              variant="ghost"
              className="h-9 w-9 p-0"
              title="Sign out"
              onClick={signOut}
            >
              <LogOut size={18} />
            </Button>
          </div>
        </header>
        <main className="min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_18%_6%,rgba(65,205,148,.10),transparent_28%),radial-gradient(circle_at_88%_8%,rgba(104,165,240,.12),transparent_30%)] p-4 lg:p-7">
          {page === "Overview" && <Overview go={setPage} />}{" "}
          {page === "Sale" && (
            <POS
              signedInName={session.name}
              signedInEmail={session.email}
            />
          )}
          {page === "Products" && <Products go={setPage} />}
          {page === "Import Products" && <ImportProducts go={setPage} />}
          {page === "Codes" && (
            <CodeCatalogue
              products={data.products.filter((p) => p.active)}
              openBilling={() => setPage("Billing")}
            />
          )}{" "}
          {page === "AI Adviser" && (
            <AiAdviser openBilling={() => setPage("Billing")} />
          )}
          {page === "Inventory" && <Inventory />}
          {page === "Sales" && <Sales />}
          {page === "Receipts" && <Receipts />}
          {page === "Purchases" && <Purchases />}
          {page === "Suppliers" && <Contacts kind="supplier" />}
          {page === "Customers" && <Contacts kind="customer" />}
          {page === "Customer Requests" && <CustomerRequests />}
          {page === "Expenses" && <Expenses />}
          {page === "Reports" && <Reports go={setPage} />}
          {page === "PDF Reports" && <PdfReports go={setPage} />}
          {page === "Staff" && <StaffView />}
          {page === "Audit Log" && <AuditView />}
          {page === "Settings" && <SettingsView />}
          {page === "Plan" && (
            <PlanView openBilling={() => setPage("Billing")} />
          )}
          {page === "Billing" && <BillingView />}
          {page === "Help" && <HelpView go={setPage} />}
          {page === "Founder" && session.founder && (
            <FounderControl currentBusinessId={session.businessId} />
          )}
        </main>
      </div>
      <GlobalSearch open={search} close={() => setSearch(false)} go={setPage} />
    </div>
  );
}
function Overview({ go }: { go: (p: Page) => void }) {
  const { data } = useApp(),
    today = new Date().toDateString();
  const sales = data.sales.filter(
      (s) =>
        new Date(s.createdAt).toDateString() === today &&
        s.status === "completed",
    ),
    revenue = sales.reduce((x, s) => x + s.total, 0),
    profit = sales.reduce(
      (x, s) => x + s.items.reduce((a, i) => a + (i.price - i.cost) * i.qty, 0),
      0,
    ),
    expenses = data.expenses
      .filter((e) => new Date(e.date).toDateString() === today)
      .reduce((x, e) => x + e.amount, 0),
    low = data.products.filter((p) => p.stock <= p.reorder);
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return {
      name: d.toLocaleDateString("en", { weekday: "short" }),
      sales: data.sales
        .filter(
          (s) => new Date(s.createdAt).toDateString() === d.toDateString(),
        )
        .reduce((x, s) => x + s.total, 0),
    };
  });
  const stats = [
    ["Sales today", revenue],
    ["Gross profit", profit],
    ["Expenses", expenses],
    ["Net estimate", profit - expenses],
  ];
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[1.3fr_1fr]">
          <div className="p-6 lg:p-8">
            <p className="text-sm font-medium text-muted">Business pulse</p>
            <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight lg:text-3xl">
              {sales.length
                ? `${sales.length} transaction${sales.length > 1 ? "s" : ""} brought in ${money(revenue, data.business.currency)} today.`
                : "Your shop is ready for its first sale today."}
            </h2>
            <p className="mt-3 text-sm text-muted">
              {low.length
                ? `${low[0].name}${low.length > 1 ? ` and ${low.length - 1} more products are` : " is"} ready for restocking.`
                : "Stock levels currently look healthy."}
            </p>
            <Button className="mt-5" onClick={() => go("Sale")}>
              Start a sale <ChevronRight size={16} />
            </Button>
          </div>
          <div className="h-52 bg-emerald-950 p-4 text-emerald-50 lg:h-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#5ee0a2" stopOpacity=".5" />
                    <stop offset="1" stopColor="#5ee0a2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <Tooltip
                  formatter={(v) => money(Number(v), data.business.currency)}
                />
                <Area
                  dataKey="sales"
                  stroke="#5ee0a2"
                  fill="url(#g)"
                  strokeWidth={2}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#a7c7b5", fontSize: 11 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([l, v]) => (
          <Card className="p-4" key={String(l)}>
            <span className="text-xs text-muted">{l}</span>
            <b className="tabular mt-2 block text-xl">
              {money(Number(v), data.business.currency)}
            </b>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-line p-4">
            <b>Needs attention</b>
            <Button variant="ghost" onClick={() => go("Inventory")}>
              View inventory
            </Button>
          </div>
          {low.length ? (
            low.slice(0, 5).map((p) => (
              <div
                className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0"
                key={p.id}
              >
                <div>
                  <b className="text-sm">{p.name}</b>
                  <span className="block text-xs text-muted">
                    Reorder at {p.reorder}
                  </span>
                </div>
                <Badge tone={p.stock === 0 ? "red" : "amber"}>
                  {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                </Badge>
              </div>
            ))
          ) : (
            <Empty
              title="Stock looks healthy"
              copy="Products that need restocking will appear here."
            />
          )}
        </Card>
        <Card>
          <div className="border-b border-line p-4">
            <b>Recent transactions</b>
          </div>
          {data.sales.length ? (
            data.sales.slice(0, 5).map((s) => (
              <div
                className="flex justify-between border-b border-line p-4 last:border-0"
                key={s.id}
              >
                <div>
                  <b className="text-sm">{s.receiptNo}</b>
                  <span className="block text-xs text-muted">
                    {s.payment} • {s.cashier}
                  </span>
                </div>
                <b>{money(s.total, data.business.currency)}</b>
              </div>
            ))
          ) : (
            <Empty
              title="No transactions yet"
              copy="Complete a sale and it will appear here."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
function Products({ go }: { go: (p: Page) => void }) {
  const { data, addProduct, setData, role } = useApp();
  const { markDownloaded, labelFor } = useDownloadFeedback();
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [limitOpen, setLimitOpen] = useState(false);
  const save = (fd: FormData) => {
    if (data.business.plan === "free" && data.products.length >= 10) {
      setOpen(false);
      setLimitOpen(true);
      return;
    }
    const name = String(fd.get("name")),
      sku = String(fd.get("sku") || `NS-${Date.now().toString().slice(-6)}`),
      code = String(
        fd.get("barcode") || `24${Date.now().toString().slice(-10)}`,
      );
    addProduct({
      name,
      description: String(fd.get("description") || ""),
      category: String(fd.get("category") || "General"),
      price: +String(fd.get("price")),
      cost: +String(fd.get("cost")),
      sku,
      barcode: code,
      qr: `NS:${code}`,
      stock: +String(fd.get("stock")),
      reorder: +String(
        fd.get("reorder") || data.business.lowStockThreshold || 2,
      ),
      unit: String(fd.get("unit") || "piece"),
      taxable: false,
      active: true,
    });
    setOpen(false);
  };
  const list = data.products.filter((p) =>
    [p.name, p.sku, p.barcode, p.category].some((value) =>
      value.toLowerCase().includes(q.trim().toLowerCase()),
    ),
  );
  const exportProducts = () => {
    download(
      `${fileSafeName(data.business.name)}-products-${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${csv(
        data.products.map((product) => ({
          product_name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          category: product.category,
          selling_price: product.price,
          cost_price: product.cost,
          stock_on_hand: product.stock,
          reorder_level: product.reorder,
          unit: product.unit,
          status: product.active ? "Active" : "Archived",
          description: product.description || "",
        })),
      )}`,
      "text/csv;charset=utf-8",
    );
    markDownloaded("products");
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button
          onClick={() =>
            data.business.plan === "free" && data.products.length >= 10
              ? setLimitOpen(true)
              : setOpen(true)
          }
        >
          <Plus size={16} /> Add product
        </Button>
        <Button variant="secondary" onClick={() => go("Import Products")}>
          <Upload size={16} /> Import products
        </Button>
        <Button
          variant="secondary"
          onClick={exportProducts}
          disabled={!data.products.length}
          aria-live="polite"
        >
          <Download size={16} /> {labelFor("products", "Export CSV")}
        </Button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-black/[.025] text-xs text-muted dark:bg-white/[.03]">
            <tr>
              {[
                "Product",
                "Code",
                "Category",
                "Price",
                "Cost",
                "Stock",
                "Status",
                "",
              ].map((x) => (
                <th className="px-4 py-3" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr className="border-t border-line" key={p.id}>
                <td className="px-4 py-3">
                  <b>{p.name}</b>
                  <span className="block text-xs text-muted">{p.sku}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.barcode}</td>
                <td className="px-4 py-3">{p.category}</td>
                <td className="px-4 py-3 font-semibold">
                  {money(p.price, data.business.currency)}
                </td>
                <td className="px-4 py-3">
                  {money(p.cost, data.business.currency)}
                </td>
                <td className="px-4 py-3">
                  {p.stock} {p.unit}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={p.active ? "green" : "neutral"}>
                    {p.active ? "Active" : "Archived"}
                  </Badge>
                </td>
                <td>
                  <Button
                    variant="ghost"
                    disabled={!can(role, "inventory")}
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        products: d.products.map((x) =>
                          x.id === p.id ? { ...x, active: !x.active } : x,
                        ),
                      }))
                    }
                  >
                    <Archive size={15} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && (
          <Empty
            title={
              data.products.length
                ? "No products match your search"
                : "Your product catalogue is empty"
            }
            copy={
              data.products.length
                ? "Try a different name or code."
                : "Add your first product, opening stock and barcode to begin selling."
            }
            action={
              !data.products.length ? (
                <Button onClick={() => setOpen(true)}>Add first product</Button>
              ) : undefined
            }
          />
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add product">
        <form action={save} className="grid gap-4">
          <Field label="Product name">
            <Input name="name" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Selling price">
              <Input name="price" type="number" min="0" required />
            </Field>
            <Field label="Cost price (optional)">
              <Input name="cost" type="number" min="0" />
            </Field>
            <Field label="Opening stock (optional)">
              <Input name="stock" type="number" min="0" />
            </Field>
            <Field label="Stock alert level (optional)">
              <Input
                name="reorder"
                type="number"
                defaultValue={data.business.lowStockThreshold || 2}
                min="0"
              />
            </Field>
            <Field label="Category">
              <Input name="category" defaultValue="General" />
            </Field>
            <Field label="Unit">
              <Select name="unit">
                <option>piece</option>
                <option>kg</option>
                <option>litre</option>
                <option>pack</option>
                <option>box</option>
              </Select>
            </Field>
            <Field label="SKU (auto if blank)">
              <Input name="sku" />
            </Field>
            <Field label="Barcode (auto if blank)">
              <Input name="barcode" />
            </Field>
          </div>
          <Field label="Description">
            <Textarea name="description" />
          </Field>
          <Button type="submit">Create product & opening stock</Button>
        </form>
      </Modal>
      <Modal
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        title="Free product limit reached"
      >
        <div className="text-center">
          <Lock className="mx-auto text-emerald-700" />
          <h3 className="mt-3 text-xl font-semibold">
            You have used all 10 free products
          </h3>
          <p className="mt-2 text-sm text-muted">
            Upgrade to Starter for unlimited products and continue growing your
            shop catalogue.
          </p>
          <Button className="mt-5" onClick={() => go("Billing")}>
            Upgrade for UGX 25,000/month
          </Button>
        </div>
      </Modal>
    </div>
  );
}
function ImportProducts({ go }: { go: (p: Page) => void }) {
  const { data, addProduct } = useApp();
  const { markDownloaded, labelFor } = useDownloadFeedback();
  const [rows, setRows] = useState<Record<string, string>[]>([]),
    [error, setError] = useState(""),
    [dragging, setDragging] = useState(false);
  const read = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setRows([]);
      setError("Please upload a CSV file.");
      return;
    }
    const text = await file.text();
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(Boolean);
    if (lines.length < 2) {
      setError("The file has no product rows.");
      return;
    }
    const headers = lines[0].split(",").map((x) => x.trim().toLowerCase());
    const parsed = lines
      .slice(1)
      .map((line) =>
        Object.fromEntries(
          line
            .split(",")
            .map((v, i) => [headers[i], v.trim().replace(/^"|"$/g, "")]),
        ),
      );
    const valid = parsed.filter(
      (r) => r.product_name && Number(r.selling_price) >= 0,
    );
    if (!valid.length) {
      setError(
        "No valid rows found. Product name and selling price are required.",
      );
      return;
    }
    setError("");
    setRows(valid);
  };
  const commit = () => {
    const capacity =
      data.business.plan === "free"
        ? Math.max(0, 10 - data.products.length)
        : rows.length;
    rows.slice(0, capacity).forEach((r, i) => {
      const code =
        r.barcode ||
        `24${Date.now().toString().slice(-8)}${String(i).padStart(2, "0")}`;
      addProduct({
        name: r.product_name,
        description: r.description || "",
        category: r.category || "General",
        price: Number(r.selling_price),
        cost: Number(r.cost_price || 0),
        sku: r.sku || `NS-${Date.now().toString().slice(-5)}-${i + 1}`,
        barcode: code,
        qr: `NS:${code}`,
        stock: Number(r.opening_stock || 0),
        reorder: Number(
          r.reorder_level || data.business.lowStockThreshold || 2,
        ),
        unit: r.unit || "piece",
        taxable: false,
        active: true,
      });
    });
    setRows([]);
    go("Products");
  };
  const template =
    "product_name,selling_price,category,cost_price,sku,barcode,opening_stock,reorder_level,unit,description\nSugar 1kg,5000,Groceries,4200,NS-001,,10,2,piece,";
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <button
        className="text-sm font-semibold text-accent"
        onClick={() => go("Products")}
      >
        ← Back to Products
      </button>
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-[#15596a] to-[#40538d] p-7 text-white">
        <Upload />
        <h2 className="mt-3 text-2xl font-semibold">Import products</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Upload many products from a CSV file. Only{" "}
          <b className="text-white">product_name</b> and{" "}
          <b className="text-white">selling_price</b> are required; every other
          field is optional.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="p-6">
          <label
            className={`grid min-h-64 cursor-pointer place-items-center rounded-xl border-2 border-dashed p-8 text-center transition ${dragging ? "scale-[1.01] border-emerald-500 bg-emerald-100/80 shadow-[0_18px_45px_rgba(13,122,83,.12)] dark:border-emerald-400 dark:bg-emerald-900/35" : "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              read(event.dataTransfer.files?.[0]);
            }}
          >
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-emerald-700 shadow">
                <Upload />
              </span>
              <b className="mt-4 block">
                {dragging
                  ? "Release to upload your CSV"
                  : "Drop your CSV here or browse"}
              </b>
              <p className="mt-2 text-sm text-muted">
                CSV files only • review before importing
              </p>
            </div>
            <input
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => read(e.target.files?.[0])}
            />
          </label>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold">CSV columns</h3>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <b>Required:</b> product_name, selling_price
            </p>
            <p className="text-muted">
              <b>Optional:</b> category, cost_price, sku, barcode,
              opening_stock, reorder_level, unit, description
            </p>
            <p className="text-muted">
              Leave codes blank and NileStock will generate them automatically.
            </p>
          </div>
          <Button
            variant="secondary"
            className="mt-5 w-full"
            onClick={() => {
              download(
                "nilestock-product-import-template.csv",
                template,
                "text/csv",
              );
              markDownloaded("import-template");
            }}
            aria-live="polite"
          >
            {labelFor("import-template", "Download CSV template")}
          </Button>
        </Card>
      </div>
      {rows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line p-4">
            <div>
              <b>{rows.length} valid products ready</b>
              <p className="text-xs text-muted">
                Review this preview before importing.
              </p>
            </div>
            <Button
              onClick={commit}
              disabled={
                data.business.plan === "free" && data.products.length >= 10
              }
            >
              Import{" "}
              {data.business.plan === "free"
                ? Math.min(rows.length, 10 - data.products.length)
                : rows.length}{" "}
              products
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">Product</th>
                  <th>Price</th>
                  <th>Category</th>
                  <th>Opening stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr className="border-t border-line" key={i}>
                    <td className="p-3 font-semibold">{r.product_name}</td>
                    <td>
                      {money(Number(r.selling_price), data.business.currency)}
                    </td>
                    <td>{r.category || "General"}</td>
                    <td>{r.opening_stock || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.business.plan === "free" &&
            rows.length > 10 - data.products.length && (
              <p className="border-t border-line bg-amber-50 p-3 text-xs text-amber-800">
                Free accounts can hold 10 products. Only the remaining available
                slots will import.
              </p>
            )}
        </Card>
      )}
    </div>
  );
}

function Inventory() {
  const { data, setData, role } = useApp();
  const [adjust, setAdjust] = useState<Product | null>(null),
    [stocktake, setStocktake] = useState(false),
    [adjustMode, setAdjustMode] = useState<"add" | "remove">("add"),
    [adjustQty, setAdjustQty] = useState(1),
    [q, setQ] = useState("");
  const value = data.products.reduce((s, p) => s + p.stock * p.cost, 0);
  const query = q.trim().toLowerCase();
  const inventoryProducts = data.products.filter((product) =>
    [product.name, product.sku, product.barcode, product.category].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
  const inventoryMovements = data.movements
    .filter((movement) =>
      [movement.productName, movement.type, movement.reference].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
    .slice(0, 20);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric l="Inventory cost" v={money(value, data.business.currency)} />
        <Metric
          l="Retail value"
          v={money(
            data.products.reduce((s, p) => s + p.stock * p.price, 0),
            data.business.currency,
          )}
        />
        <Metric
          l="Low stock"
          v={String(data.products.filter((p) => p.stock <= p.reorder).length)}
        />
        <Metric
          l="Units on hand"
          v={String(data.products.reduce((s, p) => s + p.stock, 0))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-[240px] flex-1"
          placeholder="Search inventory by product, SKU, barcode or category…"
          aria-label="Search inventory products"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <Button variant="secondary" onClick={() => setStocktake(true)}>
          <ClipboardCheck size={16} /> Stocktake
        </Button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr>
              {[
                "Product",
                "On hand",
                "Reorder",
                "Cost value",
                "Retail value",
                "Status",
                "",
              ].map((x) => (
                <th className="px-4 py-3 text-xs text-muted" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inventoryProducts.map((p) => (
              <tr className="border-t border-line" key={p.id}>
                <td className="px-4 py-3 font-semibold">{p.name}</td>
                <td className="px-4 py-3">{p.stock}</td>
                <td>{p.reorder}</td>
                <td>{money(p.stock * p.cost, data.business.currency)}</td>
                <td>{money(p.stock * p.price, data.business.currency)}</td>
                <td>
                  <Badge
                    tone={
                      p.stock === 0
                        ? "red"
                        : p.stock <= p.reorder
                          ? "amber"
                          : "green"
                    }
                  >
                    {p.stock === 0
                      ? "Out of stock"
                      : p.stock <= p.reorder
                        ? "Low stock"
                        : "In stock"}
                  </Badge>
                </td>
                <td>
                  <Button
                    variant="ghost"
                    disabled={!can(role, "inventory")}
                    onClick={() => {
                      setAdjustMode("add");
                      setAdjustQty(1);
                      setAdjust(p);
                    }}
                  >
                    Adjust
                  </Button>
                </td>
              </tr>
            ))}
            {!inventoryProducts.length && (
              <tr className="border-t border-line">
                <td className="px-4 py-8 text-center text-muted" colSpan={7}>
                  {data.products.length
                    ? "No inventory products match your search."
                    : "Add a product to start tracking inventory."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <h2 className="pt-3 font-semibold">Inventory ledger</h2>
      <Card className="divide-y divide-line">
        {inventoryMovements.map((m) => (
          <div
            className="grid grid-cols-[1fr_auto] gap-2 p-4 text-sm"
            key={m.id}
          >
            <div>
              <b>{m.productName}</b>
              <span className="block text-xs text-muted">
                {m.type} • {m.reference} • {m.user}
              </span>
            </div>
            <div
              className={`font-bold ${m.quantity > 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {m.quantity > 0 ? "+" : ""}
              {m.quantity}
            </div>
          </div>
        ))}
        {!inventoryMovements.length && (
          <p className="p-6 text-center text-sm text-muted">
            {data.movements.length
              ? "No inventory activity matches your search."
              : "Inventory movements will appear here."}
          </p>
        )}
      </Card>
      <Modal
        open={!!adjust}
        onClose={() => setAdjust(null)}
        title={`Adjust ${adjust?.name || ""}`}
      >
        <form
          action={(fd) => {
            if (!adjust) return;
            const requested = Math.max(0, Math.floor(adjustQty)),
              qty =
                adjustMode === "add"
                  ? requested
                  : -Math.min(adjust.stock, requested),
              reason = String(fd.get("reason") || "").trim();
            if (!qty) return;
            setData((d) => ({
              ...d,
              products: d.products.map((p) =>
                p.id === adjust.id
                  ? { ...p, stock: Math.max(0, p.stock + qty) }
                  : p,
              ),
              movements: [
                {
                  id: uid(),
                  productId: adjust.id,
                  productName: adjust.name,
                  type: "Adjustment",
                  quantity: qty,
                  reference: "MANUAL",
                  user: "Owner",
                  createdAt: now(),
                  notes: reason || undefined,
                },
                ...d.movements,
              ],
              audit: [
                {
                  id: uid(),
                  actor: "Owner",
                  action: "Inventory adjusted",
                  record: `${adjust.name}: ${qty > 0 ? "+" : ""}${qty}`,
                  createdAt: now(),
                },
                ...d.audit,
              ],
            }));
            setAdjust(null);
          }}
          className="grid gap-4"
        >
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/[.025] p-1 dark:bg-white/[.04]">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${adjustMode === "add" ? "bg-emerald-700 text-white shadow-sm" : "text-muted"}`}
              onClick={() => setAdjustMode("add")}
            >
              + Add stock
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${adjustMode === "remove" ? "bg-red-600 text-white shadow-sm" : "text-muted"}`}
              disabled={!adjust?.stock}
              onClick={() => {
                setAdjustMode("remove");
                setAdjustQty((current) =>
                  Math.min(current, Math.max(1, adjust?.stock || 1)),
                );
              }}
            >
              − Remove stock
            </button>
          </div>
          <Field label="Quantity">
            <div className="grid grid-cols-[44px_1fr_44px] gap-2">
              <Button
                type="button"
                variant="secondary"
                className="px-0 text-xl"
                onClick={() =>
                  setAdjustQty((current) => Math.max(1, current - 1))
                }
                aria-label="Reduce adjustment quantity"
              >
                −
              </Button>
              <Input
                name="qty"
                type="number"
                min="1"
                max={adjustMode === "remove" ? adjust?.stock : undefined}
                value={adjustQty}
                onChange={(event) =>
                  setAdjustQty(
                    Math.max(1, Math.floor(Number(event.target.value) || 1)),
                  )
                }
                className="text-center text-lg font-bold"
                required
              />
              <Button
                type="button"
                variant="secondary"
                className="px-0 text-xl"
                onClick={() =>
                  setAdjustQty((current) =>
                    adjustMode === "remove"
                      ? Math.min(adjust?.stock || 0, current + 1)
                      : current + 1,
                  )
                }
                aria-label="Increase adjustment quantity"
              >
                +
              </Button>
            </div>
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-line p-3 text-sm">
            <span className="text-muted">New stock level</span>
            <b>
              {adjustMode === "add"
                ? (adjust?.stock || 0) + adjustQty
                : Math.max(0, (adjust?.stock || 0) - adjustQty)}
            </b>
          </div>
          <Field label="Reason (optional)">
            <Input
              name="reason"
              placeholder="e.g. New delivery, damage or recount"
            />
          </Field>
          <Button
            type="submit"
            disabled={adjustMode === "remove" && !adjust?.stock}
          >
            {adjustMode === "add"
              ? "Add to inventory"
              : "Remove from inventory"}
          </Button>
        </form>
      </Modal>
      <Modal
        open={stocktake}
        onClose={() => setStocktake(false)}
        title="Stocktake"
      >
        <p className="mb-4 text-sm text-muted">
          Enter physical counts. Differences are written to the permanent
          inventory ledger.
        </p>
        <form
          action={(fd) => {
            setData((d) => {
              const changes = d.products
                .map((p) => ({ p, actual: +String(fd.get(p.id)) }))
                .filter((x) => x.actual !== x.p.stock);
              return {
                ...d,
                products: d.products.map((p) => ({
                  ...p,
                  stock: +String(fd.get(p.id)),
                })),
                movements: [
                  ...changes.map((x) => ({
                    id: uid(),
                    productId: x.p.id,
                    productName: x.p.name,
                    type: "Stocktake",
                    quantity: x.actual - x.p.stock,
                    reference: `ST-${Date.now()}`,
                    user: "Owner",
                    createdAt: now(),
                  })),
                  ...d.movements,
                ],
              };
            });
            setStocktake(false);
          }}
          className="space-y-2"
        >
          {data.products.map((p) => (
            <Field key={p.id} label={`${p.name} (expected ${p.stock})`}>
              <Input name={p.id} type="number" min="0" defaultValue={p.stock} />
            </Field>
          ))}
          <Button className="mt-3 w-full">Approve stocktake adjustments</Button>
        </form>
      </Modal>
    </div>
  );
}
function Sales() {
  const { data, setData, role } = useApp();
  const { markDownloaded, labelFor } = useDownloadFeedback();
  const [selected, setSelected] = useState<Sale | null>(null),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const filtered = data.sales.filter((s) => {
    const date = s.createdAt.slice(0, 10);
    return (!from || date >= from) && (!to || date <= to);
  });
  const downloadSalesPdf = () => {
    const total = filtered.reduce((sum, sale) => sum + sale.total, 0);
    const itemCount = filtered.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((items, item) => items + item.qty, 0),
      0,
    );
    const completed = filtered.filter((sale) => sale.status === "completed");
    const snapshot: ReportSnapshot = {
      title: "Sales report",
      period: `${from || "All dates"} to ${to || "Today"}`,
      insight: filtered.length
        ? `${filtered.length} transaction${filtered.length === 1 ? "" : "s"} are included in this report, with a recorded value of ${money(total, data.business.currency)}.`
        : "No sales match the selected date range.",
      metrics: [
        {
          label: "Recorded value",
          value: money(total, data.business.currency),
        },
        { label: "Transactions", value: String(filtered.length) },
        { label: "Items sold", value: String(itemCount) },
        { label: "Completed", value: String(completed.length) },
      ],
      rows: filtered.map((sale) => ({
        label: sale.receiptNo,
        detail: `${new Date(sale.createdAt).toLocaleString()} • ${sale.payment} • ${sale.status}`,
        value: money(sale.total, data.business.currency),
      })),
    };
    const pdf = createBrandedReportPdf(data.business, snapshot);
    pdf.save(`${fileSafeName(data.business.name)}-sales-report.pdf`);
    markDownloaded("sales-pdf");
  };
  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-xl border border-line bg-surface/75 p-3 backdrop-blur sm:grid-cols-[1fr_1fr_auto_auto]">
        <Field label="From date">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To date">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Button
          className="self-end"
          variant="secondary"
          onClick={downloadSalesPdf}
          aria-live="polite"
        >
          <FileText size={16} /> {labelFor("sales-pdf", "Download PDF")}
        </Button>
        <Button
          className="self-end"
          variant="secondary"
          onClick={() => {
            download(
              `${fileSafeName(data.business.name)}-sales.csv`,
              csv(
                filtered.map((s) => ({
                  receipt: s.receiptNo,
                  date: new Date(s.createdAt).toLocaleString(),
                  customer: s.customerName || "Walk-in",
                  cashier: s.cashier,
                  items: s.items.reduce((x, i) => x + i.qty, 0),
                  payment: s.payment,
                  total: s.total,
                  status: s.status,
                })),
              ),
              "text/csv",
            );
            markDownloaded("sales-csv");
          }}
          aria-live="polite"
        >
          {labelFor("sales-csv", "Export CSV")}
        </Button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr>
              {[
                "Receipt",
                "Date",
                "Customer",
                "Cashier",
                "Items",
                "Payment",
                "Total",
                "Status",
              ].map((x) => (
                <th className="px-4 py-3 text-xs text-muted" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                className="cursor-pointer border-t border-line hover:bg-black/[.02]"
                key={s.id}
                onClick={() => setSelected(s)}
              >
                <td className="px-4 py-3 font-semibold text-accent">
                  {s.receiptNo}
                </td>
                <td>
                  <span className="block">{day(s.createdAt)}</span>
                  <small className="text-muted">
                    {new Date(s.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </td>
                <td>{s.customerName || "Walk-in"}</td>
                <td>{s.cashier}</td>
                <td>{s.items.reduce((x, i) => x + i.qty, 0)}</td>
                <td>{s.payment}</td>
                <td className="font-semibold">
                  {money(s.total, data.business.currency)}
                </td>
                <td>
                  <Badge tone={s.status === "completed" ? "green" : "red"}>
                    {s.status}
                  </Badge>
                  {!s.synced && <Badge tone="amber">Pending sync</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <Empty
            title={
              data.sales.length ? "No sales in this date range" : "No sales yet"
            }
            copy={
              data.sales.length
                ? "Change the dates to include more transactions."
                : "Your completed sales and receipts will appear here."
            }
          />
        )}
      </Card>
      <Modal
        wide
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.receiptNo || "Receipt"}
      >
        {selected && (
          <>
            <Receipt sale={selected} />
            {selected.status === "completed" && (
              <Button
                variant="danger"
                className="mt-4 w-full"
                disabled={!can(role, "refund")}
                onClick={() => {
                  setData((d) => ({
                    ...d,
                    sales: d.sales.map((s) =>
                      s.id === selected.id
                        ? { ...s, status: "refunded", synced: false }
                        : s,
                    ),
                    products: d.products.map((p) => {
                      const i = selected.items.find(
                        (i) => i.productId === p.id,
                      );
                      return i ? { ...p, stock: p.stock + i.qty } : p;
                    }),
                    movements: [
                      ...selected.items.map((i) => ({
                        id: uid(),
                        productId: i.productId,
                        productName: i.name,
                        type: "Return",
                        quantity: i.qty,
                        reference: selected.receiptNo,
                        user: "Owner",
                        createdAt: now(),
                      })),
                      ...d.movements,
                    ],
                  }));
                  setSelected({ ...selected, status: "refunded" });
                }}
              >
                Full refund & return stock
              </Button>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

function Receipts() {
  const { data } = useApp();
  const [selected, setSelected] = useState<Sale | null>(null);
  const [query, setQuery] = useState("");
  const limit = receiptHistoryLimit(data.business.plan);
  const retained = data.sales.slice(0, limit);
  const hiddenCount = Math.max(0, data.sales.length - retained.length);
  const receipts = retained.filter((sale) =>
    [
      sale.receiptNo,
      sale.customerName || "Walk-in",
      sale.cashier,
      sale.payment,
    ].some((value) => value.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const nextTier =
    data.business.plan === "pro"
      ? null
      : data.business.plan === "business"
        ? "Pro keeps 100"
        : "Business keeps 50 and Pro keeps 100";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-5 dark:border-emerald-900 dark:from-emerald-950/40 dark:to-sky-950/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
              Receipt history
            </span>
            <h2 className="mt-1 text-xl font-semibold">
              Your {PLAN_DEFINITIONS[data.business.plan].name} plan keeps the
              latest {limit} receipts
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              After {limit} transactions, the oldest receipt copy leaves this
              page automatically. Your underlying sales records remain safely
              available in Sales and Reports.
            </p>
          </div>
          <Badge tone="green">
            {retained.length} of {limit} stored
          </Badge>
        </div>
        {nextTier && (
          <p className="mt-3 text-xs font-medium text-emerald-800 dark:text-emerald-200">
            Need a longer receipt history? {nextTier} recent receipts.
          </p>
        )}
        {hiddenCount > 0 && (
          <p className="mt-2 text-xs text-muted">
            {hiddenCount} older receipt{" "}
            {hiddenCount === 1 ? "copy is" : "copies are"} outside this plan’s
            receipt history; the sales records are still retained.
          </p>
        )}
      </div>

      <Input
        placeholder="Search receipts, customers or payment method…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <Card className="overflow-hidden">
        {receipts.length ? (
          <div className="divide-y divide-line">
            {receipts.map((sale) => (
              <button
                key={sale.id}
                className="focusable flex w-full items-center gap-3 p-4 text-left transition hover:bg-black/[.025] dark:hover:bg-white/[.035]"
                onClick={() => setSelected(sale)}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <ReceiptText size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{sale.receiptNo}</b>
                  <span className="block truncate text-xs text-muted">
                    {day(sale.createdAt)} • {sale.customerName || "Walk-in"} •{" "}
                    {sale.payment}
                  </span>
                </span>
                <span className="text-right">
                  <b className="block text-sm">
                    {money(sale.total, data.business.currency)}
                  </b>
                  <Badge tone={sale.status === "completed" ? "green" : "red"}>
                    {sale.status}
                  </Badge>
                </span>
                <ChevronRight className="hidden text-muted sm:block" size={17} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title={retained.length ? "No matching receipts" : "No receipts yet"}
            copy={
              retained.length
                ? "Try a receipt number, customer name or payment method."
                : "Complete a sale and its receipt will appear here."
            }
          />
        )}
      </Card>

      <Modal
        wide
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.receiptNo || "Receipt"}
      >
        {selected && <Receipt sale={selected} />}
      </Modal>
    </div>
  );
}

const Metric = ({ l, v }: { l: string; v: string }) => (
  <Card className="p-4">
    <span className="text-xs text-muted">{l}</span>
    <b className="mt-2 block text-xl tabular">{v}</b>
  </Card>
);
function Purchases() {
  const { data, receivePurchase } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Receive stock
        </Button>
      </div>
      <Card>
        {data.purchases.length ? (
          data.purchases.map((p) => (
            <div
              className="flex justify-between border-b border-line p-4 last:border-0"
              key={p.id}
            >
              <div>
                <b>{p.reference}</b>
                <span className="block text-xs text-muted">
                  {p.supplierName} • {day(p.date)} • {p.items.length} products
                </span>
              </div>
              <div className="text-right">
                <b>{money(p.total, data.business.currency)}</b>
                <span className="block text-xs text-muted">
                  Balance {money(p.total - p.paid, data.business.currency)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <Empty
            title="No stock received yet"
            copy="Record a supplier delivery and inventory will increase automatically."
            action={
              <Button onClick={() => setOpen(true)}>Receive first stock</Button>
            }
          />
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Receive stock">
        <form
          action={(fd) => {
            const product = data.products.find(
                (p) => p.id === fd.get("product"),
              )!,
              supplier = data.suppliers.find(
                (s) => s.id === fd.get("supplier"),
              )!,
              qty = +String(fd.get("qty")),
              cost = +String(fd.get("cost"));
            receivePurchase({
              supplierId: supplier.id,
              supplierName: supplier.name,
              reference: String(fd.get("ref")),
              date: String(fd.get("date")),
              items: [{ productId: product.id, name: product.name, qty, cost }],
              total: qty * cost,
              paid: +String(fd.get("paid") || 0),
              notes: String(fd.get("notes") || ""),
            });
            setOpen(false);
          }}
          className="grid gap-4"
        >
          <Field label="Supplier">
            <Select name="supplier" required>
              {data.suppliers.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Product">
            <Select name="product" required>
              {data.products.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <Input name="qty" type="number" min="1" required />
            </Field>
            <Field label="Unit cost">
              <Input name="cost" type="number" min="0" required />
            </Field>
            <Field label="Amount paid">
              <Input name="paid" type="number" min="0" defaultValue="0" />
            </Field>
            <Field label="Date">
              <Input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </Field>
          </div>
          <Field label="Invoice / reference">
            <Input name="ref" required />
          </Field>
          <Field label="Notes">
            <Textarea name="notes" />
          </Field>
          <Button>Receive & update inventory</Button>
        </form>
      </Modal>
    </div>
  );
}
function Contacts({ kind }: { kind: "customer" | "supplier" }) {
  const { data, setData } = useApp();
  const list = kind === "customer" ? data.customers : data.suppliers,
    [open, setOpen] = useState(false),
    [repay, setRepay] = useState<Contact | null>(null);
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Add {kind}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <Card className="p-5" key={c.id}>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 font-bold text-emerald-800">
                {c.name[0]}
              </div>
              <div>
                <b>{c.name}</b>
                <p className="text-xs text-muted">{c.phone}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted">
                  {kind === "customer" ? "Purchases" : "Purchased"}
                </span>
                <b className="block">
                  {money(c.total, data.business.currency)}
                </b>
              </div>
              <div>
                <span className="text-xs text-muted">Outstanding</span>
                <b className={c.balance ? "block text-red-600" : "block"}>
                  {money(c.balance, data.business.currency)}
                </b>
              </div>
            </div>
            {c.balance > 0 && kind === "customer" && (
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => setRepay(c)}
              >
                Record repayment
              </Button>
            )}
          </Card>
        ))}
      </div>
      {!list.length && (
        <Card>
          <Empty
            title={`No ${kind}s yet`}
            copy={`Add a ${kind} to keep their activity and balances organised.`}
          />
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`Add ${kind}`}>
        <form
          action={(fd) => {
            const c: Contact = {
              id: uid(),
              name: String(fd.get("name")),
              phone: String(fd.get("phone")),
              email: String(fd.get("email") || ""),
              address: String(fd.get("address") || ""),
              notes: String(fd.get("notes") || ""),
              balance: 0,
              total: 0,
            };
            setData((d) => ({
              ...d,
              [kind === "customer" ? "customers" : "suppliers"]: [
                c,
                ...(kind === "customer" ? d.customers : d.suppliers),
              ],
              audit: [
                {
                  id: uid(),
                  actor: "Owner",
                  action: `${kind} created`,
                  record: c.name,
                  createdAt: now(),
                },
                ...d.audit,
              ],
            }));
            setOpen(false);
          }}
          className="grid gap-4"
        >
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Phone">
            <Input name="phone" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <Field label="Address">
            <Input name="address" />
          </Field>
          <Field label="Notes">
            <Textarea name="notes" />
          </Field>
          <Button>Add {kind}</Button>
        </form>
      </Modal>
      <Modal
        open={!!repay}
        onClose={() => setRepay(null)}
        title="Record credit repayment"
      >
        <form
          action={(fd) => {
            if (!repay) return;
            const amount = Math.min(repay.balance, +String(fd.get("amount")));
            setData((d) => ({
              ...d,
              customers: d.customers.map((c) =>
                c.id === repay.id ? { ...c, balance: c.balance - amount } : c,
              ),
              audit: [
                {
                  id: uid(),
                  actor: "Owner",
                  action: "Customer credit repayment",
                  record: `${repay.name}: ${amount}`,
                  createdAt: now(),
                },
                ...d.audit,
              ],
            }));
            setRepay(null);
          }}
          className="grid gap-4"
        >
          <p className="text-sm">
            Outstanding:{" "}
            <b>{money(repay?.balance || 0, data.business.currency)}</b>
          </p>
          <Field label="Amount received">
            <Input
              name="amount"
              type="number"
              min="1"
              max={repay?.balance}
              required
            />
          </Field>
          <Button>Record repayment</Button>
        </form>
      </Modal>
    </div>
  );
}
function Expenses() {
  const { data, addExpense } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-4 flex justify-between">
        <Metric
          l="Total expenses"
          v={money(
            data.expenses.reduce((s, e) => s + e.amount, 0),
            data.business.currency,
          )}
        />
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Record expense
        </Button>
      </div>
      <Card>
        {data.expenses.length ? (
          data.expenses.map((e) => (
            <div
              className="flex justify-between border-b border-line p-4 last:border-0"
              key={e.id}
            >
              <div>
                <b>{e.description}</b>
                <span className="block text-xs text-muted">
                  {e.category} • {day(e.date)} • {e.payment}
                </span>
              </div>
              <b>{money(e.amount, data.business.currency)}</b>
            </div>
          ))
        ) : (
          <Empty
            title="No expenses recorded"
            copy="Record rent, transport, utilities and other operational costs for accurate profit estimates."
          />
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Record expense">
        <form
          action={(fd) => {
            addExpense({
              category: String(fd.get("category")),
              description: String(fd.get("description")),
              amount: +String(fd.get("amount")),
              payment: String(fd.get("payment")) as PaymentMethod,
              date: String(fd.get("date")),
              payee: String(fd.get("payee") || ""),
              reference: String(fd.get("reference") || ""),
              notes: String(fd.get("notes") || ""),
            });
            setOpen(false);
          }}
          className="grid gap-4"
        >
          <Field label="Category">
            <Select name="category">
              {[
                "Rent",
                "Utilities",
                "Transport",
                "Salaries",
                "Repairs",
                "Supplies",
                "Marketing",
                "Other",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <Field label="Description">
            <Input name="description" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <Input name="amount" type="number" min="1" required />
            </Field>
            <Field label="Date">
              <Input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </Field>
          </div>
          <Field label="Payment">
            <Select name="payment">
              {["Cash", "Mobile Money", "Card", "Bank", "Other"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <Field label="Payee">
            <Input name="payee" />
          </Field>
          <Button>Save expense</Button>
        </form>
      </Modal>
    </div>
  );
}
function Reports({ go }: { go: (p: Page) => void }) {
  const { data } = useApp();
  const { markDownloaded, labelFor } = useDownloadFeedback();
  const revenue = data.sales
      .filter((s) => s.status === "completed")
      .reduce((x, s) => x + s.total, 0),
    cogs = data.sales
      .filter((s) => s.status === "completed")
      .reduce((x, s) => x + s.items.reduce((a, i) => a + i.cost * i.qty, 0), 0),
    expense = data.expenses.reduce((x, e) => x + e.amount, 0);
  const pay = Object.entries(
    data.sales.reduce(
      (a, s) => ((a[s.payment] = (a[s.payment] || 0) + s.total), a),
      {} as Record<string, number>,
    ),
  ).map(([name, value]) => ({ name, value }));
  const products = Object.values(
    data.sales
      .flatMap((s) => s.items)
      .reduce(
        (a, i) => ((a[i.name] = (a[i.name] || 0) + i.qty), a),
        {} as Record<string, number>,
      ),
  ).length
    ? Object.entries(
        data.sales
          .flatMap((s) => s.items)
          .reduce(
            (a, i) => ((a[i.name] = (a[i.name] || 0) + i.qty), a),
            {} as Record<string, number>,
          ),
      )
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 6)
    : data.products.slice(0, 6).map((p) => ({ name: p.name, qty: 0 }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => go("PDF Reports")}>
          <FileText size={16} /> Open PDF report centre
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            download(
              `${fileSafeName(data.business.name)}-business-report.csv`,
              csv(
                data.sales.map((s) => ({
                  receipt: s.receiptNo,
                  date: s.createdAt,
                  payment: s.payment,
                  total: s.total,
                  status: s.status,
                })),
              ),
              "text/csv",
            );
            markDownloaded("business-report-csv");
          }}
          aria-live="polite"
        >
          {labelFor("business-report-csv", "Export report CSV")}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric l="Revenue" v={money(revenue, data.business.currency)} />
        <Metric
          l="Gross profit"
          v={money(revenue - cogs, data.business.currency)}
        />
        <Metric
          l="Operating expenses"
          v={money(expense, data.business.currency)}
        />
        <Metric
          l="Estimated net profit"
          v={money(revenue - cogs - expense, data.business.currency)}
        />
      </div>
      <p className="text-xs text-muted">
        Profit is estimated from recorded sale prices, product costs and
        operational expenses.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <b>Best-selling products</b>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={products} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar dataKey="qty" fill="#0d7a53" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <b>Payment mix</b>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pay.length ? pay : [{ name: "No sales", value: 1 }]}
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {(pay.length ? pay : [1]).map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        ["#0d7a53", "#e2a93b", "#4d75b8", "#9a6ab0", "#7d857f"][
                          i % 5
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => money(Number(v), data.business.currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {pay.map((p, i) => (
              <span key={p.name}>
                <i
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{
                    background: [
                      "#0d7a53",
                      "#e2a93b",
                      "#4d75b8",
                      "#9a6ab0",
                      "#7d857f",
                    ][i % 5],
                  }}
                />
                {p.name} {money(p.value, data.business.currency)}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
function StaffView() {
  const { data, setData, role } = useApp();
  const [open, setOpen] = useState(false),
    [shift, setShift] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setShift(true)}>
          Manage shift
        </Button>
        <Button
          disabled={!can(role, "staff-role")}
          onClick={() => setOpen(true)}
        >
          <Plus size={16} /> Add staff
        </Button>
      </div>
      <Card>
        {data.staff.map((s) => (
          <div
            className="flex items-center gap-3 border-b border-line p-4 last:border-0"
            key={s.id}
          >
            <div className="grid h-9 w-9 place-items-center rounded-full bg-black/5 font-bold">
              {s.name[0]}
            </div>
            <div className="flex-1">
              <b>{s.name}</b>
              <span className="block text-xs text-muted">
                {s.email} • {s.role}
              </span>
            </div>
            <Badge tone={s.status === "active" ? "green" : "neutral"}>
              {s.status}
            </Badge>
            {s.role !== "owner" && (
              <Button
                variant="ghost"
                onClick={() =>
                  setData((d) => ({
                    ...d,
                    staff: d.staff.map((x) =>
                      x.id === s.id
                        ? {
                            ...x,
                            status:
                              x.status === "active" ? "disabled" : "active",
                          }
                        : x,
                    ),
                  }))
                }
              >
                Toggle
              </Button>
            )}
          </div>
        ))}
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add staff member"
      >
        <form
          action={(fd) => {
            const s: Staff = {
              id: uid(),
              name: String(fd.get("name")),
              email: String(fd.get("email")),
              role: String(fd.get("role")) as any,
              status: "active",
            };
            setData((d) => ({
              ...d,
              staff: [...d.staff, s],
              audit: [
                {
                  id: uid(),
                  actor: "Owner",
                  action: "Staff added",
                  record: s.name,
                  createdAt: now(),
                },
                ...d.audit,
              ],
            }));
            setOpen(false);
          }}
          className="grid gap-4"
        >
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Role">
            <Select name="role">
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </Select>
          </Field>
          <Button>Add staff</Button>
        </form>
      </Modal>
      <Modal open={shift} onClose={() => setShift(false)} title="Cashier shift">
        {data.shifts.find((s) => s.status === "open") ? (
          <form
            action={(fd) => {
              const counted = +String(fd.get("counted")),
                openShift = data.shifts.find((s) => s.status === "open")!,
                cash = data.sales
                  .filter(
                    (s) =>
                      s.payment === "Cash" && s.createdAt >= openShift.openedAt,
                  )
                  .reduce((a, s) => a + s.total, 0);
              setData((d) => ({
                ...d,
                shifts: d.shifts.map((s) =>
                  s.id === openShift.id
                    ? {
                        ...s,
                        status: "closed",
                        closedAt: now(),
                        counted,
                        expected: s.opening + cash,
                      }
                    : s,
                ),
              }));
              setShift(false);
            }}
            className="grid gap-4"
          >
            <p>
              Open shift started{" "}
              {new Date(
                data.shifts.find((s) => s.status === "open")!.openedAt,
              ).toLocaleString()}
            </p>
            <Field label="Counted cash">
              <Input name="counted" type="number" required />
            </Field>
            <Button>Close shift & reconcile</Button>
          </form>
        ) : (
          <form
            action={(fd) => {
              setData((d) => ({
                ...d,
                shifts: [
                  {
                    id: uid(),
                    cashier: "Shop Owner",
                    openedAt: now(),
                    opening: +String(fd.get("opening")),
                    status: "open",
                  },
                  ...d.shifts,
                ],
              }));
              setShift(false);
            }}
            className="grid gap-4"
          >
            <Field label="Opening cash">
              <Input name="opening" type="number" min="0" required />
            </Field>
            <Button>Open shift</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
function AuditView() {
  const { data } = useApp();
  return (
    <Card className="divide-y divide-line">
      {data.audit.map((a) => (
        <div className="grid grid-cols-[1fr_auto] p-4 text-sm" key={a.id}>
          <div>
            <b>{a.action}</b>
            <span className="block text-xs text-muted">
              {a.actor} • {a.record}
            </span>
          </div>
          <time className="text-xs text-muted">
            {new Date(a.createdAt).toLocaleString()}
          </time>
        </div>
      ))}
    </Card>
  );
}
function SettingsView() {
  const { data, setData, reset, role } = useApp();
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-5">
        <form
          action={(fd) => {
            setData((d) => ({
              ...d,
              business: {
                ...d.business,
                name: String(fd.get("name")),
                phone: String(fd.get("phone")),
                email: String(fd.get("email")),
                address: String(fd.get("address")),
                country: String(fd.get("country")),
                currency: String(fd.get("currency")),
                taxEnabled: fd.get("taxEnabled") === "on",
                taxRate: +String(fd.get("taxRate")),
                lowStockThreshold: +String(fd.get("lowStockThreshold") || 2),
                receiptFooter: String(fd.get("footer")),
                paper: String(fd.get("paper")) as any,
                theme: String(fd.get("theme")) as any,
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
          }}
          className="grid gap-5"
        >
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
            </Field>
            <Field label="Appearance">
              <Select name="theme" defaultValue={data.business.theme}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </Select>
            </Field>
          </div>
          <Button disabled={!can(role, "settings")}>Save settings</Button>
        </form>
      </Card>
      <Card className="mt-4 border-red-200 p-5">
        <h2 className="font-semibold text-red-700">Local data</h2>
        <p className="my-2 text-sm text-muted">
          Permanently clear the business information saved in this browser and
          return to an empty account.
        </p>
        <Button
          variant="danger"
          onClick={() => confirm("Reset all local demo data?") && reset()}
        >
          Clear local business data
        </Button>
      </Card>
    </div>
  );
}
function GlobalSearch({
  open,
  close,
  go,
}: {
  open: boolean;
  close: () => void;
  go: (p: Page) => void;
}) {
  const { data } = useApp();
  const [q, setQ] = useState("");
  const items = [
    ...data.products.map((x) => ({
      title: x.name,
      sub: `Product • ${x.sku}`,
      page: "Products" as Page,
    })),
    ...data.sales.map((x) => ({
      title: x.receiptNo,
      sub: `Sale • ${money(x.total, data.business.currency)}`,
      page: "Sales" as Page,
    })),
    ...data.customers.map((x) => ({
      title: x.name,
      sub: "Customer",
      page: "Customers" as Page,
    })),
    ...data.suppliers.map((x) => ({
      title: x.name,
      sub: "Supplier",
      page: "Suppliers" as Page,
    })),
  ]
    .filter((x) =>
      `${x.title} ${x.sub}`.toLowerCase().includes(q.toLowerCase()),
    )
    .slice(0, 12);
  return (
    <Modal open={open} onClose={close} title="Search NileStock">
      <Input
        autoFocus
        placeholder="Products, receipts, customers, suppliers…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-3 divide-y divide-line">
        {q &&
          items.map((x, i) => (
            <button
              className="flex w-full items-center justify-between py-3 text-left"
              key={i}
              onClick={() => {
                go(x.page);
                close();
              }}
            >
              <span>
                <b className="block text-sm">{x.title}</b>
                <small className="text-muted">{x.sub}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        {q && !items.length && (
          <p className="p-6 text-center text-sm text-muted">
            No matching records.
          </p>
        )}
      </div>
    </Modal>
  );
}

function CustomerRequests() {
  const { data, setData } = useApp();
  const { markDownloaded, labelFor } = useDownloadFeedback();
  const [open, setOpen] = useState(false);
  const requests = data.requests || [];
  const exportPdf = () => {
    const openRequests = requests.filter((request) => request.status === "open");
    const requestedUnits = requests.reduce(
      (sum, request) => sum + request.quantity,
      0,
    );
    const snapshot: ReportSnapshot = {
      title: "Customer product requests",
      period: "Current request book",
      insight: requests.length
        ? `${requests.length} customer request${requests.length === 1 ? " is" : "s are"} recorded, including ${openRequests.length} still open.`
        : "No customer product requests have been recorded yet.",
      metrics: [
        { label: "Total requests", value: String(requests.length) },
        { label: "Open requests", value: String(openRequests.length) },
        { label: "Requested units", value: String(requestedUnits) },
        {
          label: "Sourced",
          value: String(
            requests.filter((request) => request.status === "sourced").length,
          ),
        },
      ],
      rows: requests.map((request) => ({
        label: request.product,
        detail: `${request.customer || "Walk-in"} • ${request.status} • ${day(request.createdAt)}`,
        value: `${request.quantity} units`,
      })),
    };
    const pdf = createBrandedReportPdf(data.business, snapshot);
    pdf.save(`${fileSafeName(data.business.name)}-customer-requests.pdf`);
    markDownloaded("customer-requests");
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          onClick={exportPdf}
          disabled={!requests.length}
          aria-live="polite"
        >
          {labelFor("customer-requests", "Download PDF")}
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Record request
        </Button>
      </div>
      <Card>
        {requests.length ? (
          requests.map((r) => (
            <div
              className="flex items-center gap-3 border-b border-line p-4 last:border-0"
              key={r.id}
            >
              <div className="flex-1">
                <b>{r.product}</b>
                <span className="block text-xs text-muted">
                  {r.customer || "Walk-in customer"} • Qty {r.quantity} •{" "}
                  {day(r.createdAt)}
                </span>
              </div>
              <Select
                className="w-28"
                value={r.status}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    requests: (d.requests || []).map((x) =>
                      x.id === r.id
                        ? { ...x, status: e.target.value as any }
                        : x,
                    ),
                  }))
                }
              >
                <option value="open">Open</option>
                <option value="sourced">Sourced</option>
                <option value="closed">Closed</option>
              </Select>
            </div>
          ))
        ) : (
          <Empty
            title="No missing-product requests"
            copy="Record products customers asked for but could not find in the shop."
          />
        )}
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record customer request"
      >
        <form
          className="grid gap-4"
          action={(fd) => {
            const request = {
              id: uid(),
              product: String(fd.get("product")),
              customer: String(fd.get("customer") || ""),
              phone: String(fd.get("phone") || ""),
              quantity: +String(fd.get("quantity") || 1),
              notes: String(fd.get("notes") || ""),
              status: "open" as const,
              createdAt: now(),
            };
            setData((d) => ({
              ...d,
              requests: [request, ...(d.requests || [])],
              audit: [
                {
                  id: uid(),
                  actor: "Owner",
                  action: "Customer request recorded",
                  record: request.product,
                  createdAt: now(),
                },
                ...d.audit,
              ],
            }));
            setOpen(false);
          }}
        >
          <Field label="Requested product">
            <Input name="product" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer">
              <Input name="customer" />
            </Field>
            <Field label="Phone">
              <Input name="phone" />
            </Field>
          </div>
          <Field label="Quantity wanted">
            <Input
              name="quantity"
              type="number"
              min="1"
              defaultValue="1"
              required
            />
          </Field>
          <Field label="Notes">
            <Textarea name="notes" />
          </Field>
          <Button>Save request</Button>
        </form>
      </Modal>
    </div>
  );
}

function PdfReports({ go }: { go: (p: Page) => void }) {
  const { data } = useApp();
  const { markDownloaded, labelFor } = useDownloadFeedback();
  const canExport = hasMinimumPlan(data.business.plan, "business");
  const create = (kind: ReportKind, share = false) => {
    if (!canExport) {
      go("Billing");
      return;
    }
    const snapshot = buildReportSnapshot(data, kind);
    const pdf = createBrandedReportPdf(data.business, snapshot);
    const filename = `${fileSafeName(data.business.name)}-${kind.toLowerCase().replaceAll(" ", "-")}-report.pdf`;
    if (!share) {
      pdf.save(filename);
      markDownloaded(kind);
      return;
    }
    const file = new File([pdf.output("blob")], filename, {
      type: "application/pdf",
    });
    if (navigator.share && navigator.canShare?.({ files: [file] }))
      return navigator
        .share({
          title: `${data.business.name} ${kind} report`,
          text: `${data.business.name} ${kind.toLowerCase()} report`,
          files: [file],
        })
        .catch(() => {});
    pdf.save(filename);
    markDownloaded(kind);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${data.business.name} ${kind} report is ready. The PDF has downloaded; attach ${filename} in this chat.`)}`,
      "_blank",
    );
  };
  return (
    <div>
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-950 via-[#165464] to-[#435b98] p-7 text-white shadow-[0_24px_70px_rgba(19,76,73,.2)]">
        <div className="flex items-center gap-3">
          <FileText />
          {!canExport && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/18 px-3 py-1 text-xs font-bold text-red-100">
              <Lock size={13} /> BUSINESS
            </span>
          )}
        </div>
        <h2 className="mt-3 text-2xl font-semibold">Business report centre</h2>
        <p className="mt-1 text-sm text-white/70">
          Read every live report here. Business and Pro unlock polished PDF
          downloads and WhatsApp sharing. Your plan is{" "}
          <b className="capitalize text-white">{data.business.plan}</b>.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_KINDS.map((kind) => {
          const report = buildReportSnapshot(data, kind);
          return (
            <Card className="relative overflow-hidden p-5" key={kind}>
              <div className="h-24 overflow-hidden rounded-lg bg-gradient-to-br from-sky-50 to-indigo-50 p-3 dark:from-sky-950 dark:to-indigo-950">
                <svg viewBox="0 0 180 60" className="h-full w-full">
                  <path
                    d="M0 48 C25 35 35 40 55 24 S90 38 115 20 S145 32 180 8"
                    fill="none"
                    stroke="#7aa7e8"
                    strokeWidth="5"
                    opacity=".35"
                  />
                  <path
                    d="M0 48 C25 35 35 40 55 24 S90 38 115 20 S145 32 180 8"
                    fill="none"
                    stroke="#3278c8"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <b className="block">{report.title}</b>
                  <p className="mt-1 text-xs text-muted">{report.period}</p>
                </div>
                {!canExport && <Badge tone="red">BUSINESS</Badge>}
              </div>
              <p className="mt-3 min-h-12 text-sm leading-5 text-muted">
                {report.insight}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-black/[.025] p-3 text-xs dark:bg-white/[.04]">
                {report.metrics.slice(0, 2).map((metric) => (
                  <div key={metric.label}>
                    <span className="text-muted">{metric.label}</span>
                    <b className="mt-1 block">{metric.value}</b>
                  </div>
                ))}
              </div>
              {canExport ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => create(kind)}
                    aria-live="polite"
                  >
                    {labelFor(kind, "Download")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => create(kind, true)}
                  >
                    WhatsApp
                  </Button>
                </div>
              ) : (
                <Button className="mt-4 w-full" onClick={() => go("Billing")}>
                  <Lock size={15} /> Upgrade to download
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const billingPlans = PLAN_ORDER.map((plan) => PLAN_DEFINITIONS[plan]);
function BillingView() {
  const { data, setData } = useApp();
  const [annual, setAnnual] = useState(false),
    [chosen, setChosen] = useState<(typeof billingPlans)[number] | null>(null),
    [billingBusy, setBillingBusy] = useState(false),
    [billingError, setBillingError] = useState("");
  const request = async (method: string) => {
    if (!chosen) return;
    setBillingBusy(true);
    setBillingError("");
    const supabase = getSupabaseBrowserClient();
    const businessId = localStorage.getItem("nilestock.cloud.businessId");
    if (supabase && businessId && chosen.price > 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("nilestock_billing_requests")
        .insert({
          business_id: businessId,
          requested_plan: chosen.id,
          billing_cycle: annual ? "annual" : "monthly",
          payment_method: method,
          requested_by: user?.id,
        });
      if (error) {
        setBillingError(error.message);
        setBillingBusy(false);
        return;
      }
    }
    setData((d) => ({
      ...d,
      audit: [
        {
          id: uid(),
          actor: "Owner",
          action: "Plan upgrade requested",
          record: `${chosen.name} via ${method}`,
          createdAt: now(),
        },
        ...d.audit,
      ],
    }));
    const amount = annual ? chosen.price * 10 : chosen.price;
    location.href = `https://wa.me/256753523529?text=${encodeURIComponent(`Hello, I want to activate NileStock ${chosen.name} (${annual ? "annual" : "monthly"}) for ${money(amount)}. My business is ${data.business.name}. Preferred payment: ${method}.`)}`;
  };
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#073e31,#15596a_55%,#40538d)] p-7 text-white shadow-[0_24px_70px_rgba(15,75,66,.24)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CircleDollarSign />
            <h2 className="mt-3 text-2xl font-semibold">Plans & billing</h2>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              Choose the capacity your shop needs. Upgrade requests go directly
              to NileStock support for activation.
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 text-right">
            <small className="text-white/60">Current plan</small>
            <b className="block capitalize">{data.business.plan}</b>
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${!annual ? "bg-ink text-surface" : ""}`}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${annual ? "bg-ink text-surface" : ""}`}
            onClick={() => setAnnual(true)}
          >
            Annual <span className="text-emerald-600">2 months free</span>
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {billingPlans.map((plan) => (
          <Card
            className={`relative flex min-h-[410px] flex-col overflow-hidden p-6 ${plan.popular ? "border-emerald-500 shadow-[0_20px_50px_rgba(13,122,83,.14)]" : ""}`}
            key={plan.id}
          >
            {plan.popular && (
              <div className="absolute right-0 top-0 rounded-bl-xl bg-emerald-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Most popular
              </div>
            )}
            <span className="text-xs font-bold uppercase tracking-[.16em] text-muted">
              {plan.copy}
            </span>
            <h3 className="mt-4 text-2xl font-semibold">{plan.name}</h3>
            <div className="mt-3">
              <b className="text-3xl">
                {plan.price
                  ? money(annual ? plan.price * 10 : plan.price)
                  : "Free"}
              </b>
              {plan.price > 0 && (
                <small className="text-muted">
                  {" "}
                  / {annual ? "year" : "month"}
                </small>
              )}
            </div>
            {annual && plan.price > 0 && (
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Save {money(plan.price * 2)} yearly
              </p>
            )}
            <div className="my-6 h-px bg-line" />
            <ul className="space-y-3 text-sm">
              {plan.features.map((f) => (
                <li className="flex gap-2" key={f}>
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                    <Check size={12} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-auto w-full"
              variant={
                data.business.plan === plan.id
                  ? "secondary"
                  : plan.popular
                    ? "primary"
                    : "secondary"
              }
              disabled={data.business.plan === plan.id}
              onClick={() => setChosen(plan)}
            >
              {data.business.plan === plan.id
                ? "Current plan"
                : plan.price
                  ? "Choose plan"
                  : "Downgrade to Free"}
            </Button>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <b>Billing history</b>
            <p className="text-sm text-muted">
              Invoices and successful subscription payments will appear here.
            </p>
          </div>
          <Badge tone="neutral">No payments yet</Badge>
        </div>
      </Card>
      <Modal
        open={!!chosen}
        onClose={() => setChosen(null)}
        title={`Activate ${chosen?.name || ""}`}
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] dark:border-sky-800/60 dark:from-[#0b3037] dark:via-[#102a43] dark:to-[#17294f]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800 dark:text-emerald-300">
                Amount due
              </span>
              <span className="rounded-full border border-white/70 bg-white/65 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-sky-700/60 dark:bg-sky-950/55 dark:text-sky-200">
                {annual ? "Annual" : "Monthly"}
              </span>
            </div>
            <b className="mt-3 block text-3xl tracking-[-.03em] text-slate-950 dark:text-white">
              {chosen &&
                (chosen.price
                  ? money(annual ? chosen.price * 10 : chosen.price)
                  : "Free")}
            </b>
            <p className="mt-2 text-xs text-slate-600 dark:text-sky-200/75">
              {annual ? "Annual billing • two months free" : "Monthly billing"}
            </p>
          </div>
          <p className="text-sm text-muted">
            Choose how you want to complete activation. NileStock support will
            confirm payment and grant access.
          </p>
          {billingError && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/45 dark:text-red-200">
              We could not save this request: {billingError}
            </p>
          )}
          <div className="grid gap-2">
            <Button
              disabled={billingBusy}
              onClick={() => request("Mobile Money")}
            >
              Continue with Mobile Money
            </Button>
            <Button
              variant="secondary"
              disabled={billingBusy}
              onClick={() => request("Bank transfer")}
            >
              Request bank details
            </Button>
            <Button
              variant="secondary"
              disabled={billingBusy}
              onClick={() => request("Card / online payment")}
            >
              Card / online payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function HelpView({ go }: { go: (p: Page) => void }) {
  const guides = [
    [
      "Make a sale",
      "Scan or tap products, review the automatic total, press Pay, select a payment method and complete.",
      "Sale",
    ],
    [
      "Add products and codes",
      "Create a product. A unique barcode and QR value can be generated and printed from Codes.",
      "Products",
    ],
    [
      "Receive stock",
      "Record supplier deliveries under Purchases. Product stock and the inventory ledger update automatically.",
      "Purchases",
    ],
    [
      "Handle customer debt",
      "Choose Customer Credit at checkout, select a customer, then record repayments from Customers.",
      "Customers",
    ],
    [
      "Track unavailable products",
      "Record what customers requested but could not find, then export the list for purchasing.",
      "Customer Requests",
    ],
    [
      "Download reports",
      "Every report stays readable on screen. Business and Pro unlock branded PDF downloads and WhatsApp sharing under PDF Reports.",
      "PDF Reports",
    ],
    [
      "Ask the AI adviser",
      "Pro users can evaluate performance, plan strategy and find product or stock opportunities using live business records.",
      "AI Adviser",
    ],
    [
      "Understand your plan",
      "Open Plan to see your current access, every tier and the next benefits available to your business.",
      "Plan",
    ],
    [
      "Install on phone",
      "Open NileStock in Chrome or Safari, use Install App/Add to Home Screen, then launch it like a native app.",
      "Settings",
    ],
  ];
  const menuHelp = [
    [
      "Overview",
      "Shows today’s sales, profit, expenses, business pulse, low-stock alerts and recent transactions.",
    ],
    [
      "Sale",
      "The fastest checkout screen. Search or scan products, change quantities, hold carts, take payment and generate receipts.",
    ],
    [
      "Products",
      "Add, search, archive and manage product prices, costs, stock and codes.",
    ],
    [
      "Codes",
      "Generate and preview product barcodes and QR codes. Starter and higher plans can print, download or share code sheets.",
    ],
    [
      "AI Adviser",
      "A Pro business chatbot grounded in your sales, products, stock, expenses and customer requests. Other plans can preview the interface but cannot send questions.",
    ],
    [
      "Inventory",
      "View stock status, inventory value, movement history, make authorised adjustments and complete stocktakes.",
    ],
    [
      "Sales",
      "View every transaction with date and time, filter dates, download reports, open receipts and process refunds.",
    ],
    [
      "Customer Requests",
      "Record products customers wanted but could not find, then export the request list for purchasing.",
    ],
    [
      "Expenses",
      "Record operating costs such as rent, transport, utilities and salaries for profit reporting.",
    ],
    [
      "Reports",
      "View sales, profit, products, payments and performance charts, then continue to downloadable PDF reports.",
    ],
    [
      "PDF Reports",
      "Read current business reports on every plan. Business and Pro accounts can download or WhatsApp the branded PDF version.",
    ],
    [
      "Staff",
      "Create managers and cashiers, disable access and open or reconcile cashier shifts.",
    ],
    [
      "Audit Log",
      "A read-only accountability history of sales, stock, products, staff and settings changes.",
    ],
    [
      "Settings",
      "Change business contacts, location, currency, tax, receipt footer, theme and the automatic low-stock alert level.",
    ],
    [
      "Plan",
      "Shows your current tier, included access, the full feature matrix and relevant upgrade benefits.",
    ],
    [
      "Billing",
      "Compare Free, Starter, Business and Pro, choose monthly or annual billing and request plan activation.",
    ],
    [
      "Purchases",
      "Receive supplier stock. Quantities increase automatically and movements are recorded.",
    ],
    [
      "Suppliers",
      "Maintain supplier contact information, purchase totals and outstanding balances.",
    ],
    [
      "Customers",
      "Store customer contacts, purchase history, credit balances and repayments.",
    ],
    ["Help", "Opens this guide and NileStock support contacts."],
    [
      "Profile initials",
      "Your signed-in account profile, showing initials from your saved full name. Use the role selector during testing to preview Owner, Manager and Cashier permissions.",
    ],
    [
      "Signed-in name",
      "Your saved account name appears here, including the Google profile name captured during sign-in.",
    ],
    [
      "Search icon",
      "Search products, receipts, customers and suppliers from anywhere.",
    ],
    [
      "Bell icon",
      "Opens products requiring attention; the red dot appears automatically when stock reaches the configured alert level.",
    ],
    ["Theme icon", "Switches between the light and dark workspace appearance."],
    [
      "Sign-out icon",
      "Securely ends the current NileStock session and returns to the landing page.",
    ],
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card className="bg-gradient-to-br from-sky-50 to-emerald-50 p-7 dark:from-sky-950 dark:to-emerald-950">
        <HelpCircle className="text-emerald-700" />
        <h2 className="mt-3 text-2xl font-semibold">How can we help?</h2>
        <p className="mt-1 text-sm text-muted">
          A practical guide to every important NileStock workflow.
        </p>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {guides.map(([title, copy, target]) => (
          <Card className="p-5" key={title}>
            <b>{title}</b>
            <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            <Button
              variant="ghost"
              className="mt-2 px-0 text-accent"
              onClick={() => go(target as Page)}
            >
              Open {target} <ChevronRight size={15} />
            </Button>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="border-b border-line p-5">
          <h3 className="font-semibold">Every page and button explained</h3>
          <p className="mt-1 text-sm text-muted">
            Tap any item to see what it does.
          </p>
        </div>
        <div className="divide-y divide-line">
          {menuHelp.map(([title, copy]) => (
            <details className="group p-4" key={title}>
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                <span>{title}</span>
                <ChevronRight
                  size={16}
                  className="transition group-open:rotate-90"
                />
              </summary>
              <p className="mt-3 pr-8 text-sm leading-6 text-muted">{copy}</p>
            </details>
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold">Still need help?</h3>
        <p className="mt-2 text-sm text-muted">
          Contact Nile AI Solutions for onboarding, deployment or technical
          support.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              (location.href =
                "mailto:hello@nileai.solutions?subject=NileStock support")
            }
          >
            Email support
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              (location.href =
                "https://wa.me/256753523529?text=" +
                encodeURIComponent("Hello, I need help with NileStock."))
            }
          >
            WhatsApp support
          </Button>
        </div>
      </Card>
    </div>
  );
}
