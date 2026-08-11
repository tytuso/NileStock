import { AppData, CartItem } from "./types";
import { DEFAULT_THEME } from "./theme";
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const money = (n: number, c = "UGX") =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: c,
    maximumFractionDigits: c === "UGX" ? 0 : 2,
  }).format(n);
export function totals(items: CartItem[], cartDiscount = 0, taxRate = 0) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const itemDiscount = items.reduce((s, i) => s + i.discount * i.qty, 0);
  const discount = Math.min(subtotal, itemDiscount + cartDiscount);
  const tax = Math.round(((subtotal - discount) * taxRate) / 100);
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}
export const download = (
  name: string,
  content: BlobPart,
  type = "text/plain",
) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
};
export const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  return [
    keys.join(","),
    ...rows.map((r) =>
      keys
        .map((k) => `"${String(r[k] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");
};
export const can = (role: string, action: string) =>
  role === "owner" ||
  (role === "manager" &&
    !["settings", "staff-role", "void"].includes(action)) ||
  (role === "cashier" &&
    ["sell", "view-products", "customer"].includes(action));
export const day = (d: string) =>
  new Date(d).toLocaleDateString("en-UG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export const fileSafeName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "business";
export const demoData = (): AppData => {
  const t = now();
  return {
    products: [],
    sales: [],
    customers: [],
    suppliers: [],
    expenses: [],
    purchases: [],
    movements: [],
    staff: [],
    audit: [],
    shifts: [],
    held: [],
    business: {
      name: "My Shop",
      country: "Uganda",
      currency: "UGX",
      phone: "",
      email: "",
      address: "",
      taxRate: 0,
      taxEnabled: false,
      lowStockThreshold: 2,
      receiptFooter: "Thank you for shopping with us.",
      paper: "80mm",
      theme: DEFAULT_THEME,
      plan: "free",
    },
    onboarded: true,
  };
};
