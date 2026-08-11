import type { AppData } from "./types";
import { day, money } from "./utils";

export const REPORT_KINDS = [
  "Daily",
  "Weekly",
  "Monthly",
  "Sales",
  "Profit",
  "Inventory",
  "Expenses",
  "Customer Credit",
  "Supplier",
  "Customer Requests",
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];
export type ReportSnapshot = {
  title: string;
  period: string;
  insight: string;
  metrics: { label: string; value: string }[];
  rows: { label: string; detail: string; value: string }[];
};

const windows: Partial<Record<ReportKind, number>> = {
  Daily: 86_400_000,
  Weekly: 604_800_000,
  Monthly: 2_678_400_000,
};

export function buildReportSnapshot(
  data: AppData,
  kind: ReportKind,
): ReportSnapshot {
  const currency = data.business.currency;
  const windowMs = windows[kind];
  const within = (value: string) =>
    !windowMs || Date.now() - new Date(value).getTime() < windowMs;
  const sales = data.sales.filter(
    (sale) => sale.status === "completed" && within(sale.createdAt),
  );
  const expenses = data.expenses.filter((expense) =>
    windowMs ? within(expense.date) : true,
  );
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const cost = sales.reduce(
    (sum, sale) =>
      sum + sale.items.reduce((line, item) => line + item.cost * item.qty, 0),
    0,
  );
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const grossProfit = revenue - cost;
  const netEstimate = grossProfit - expenseTotal;
  const saleRows = sales.slice(0, 18).map((sale) => ({
    label: sale.receiptNo,
    detail: `${day(sale.createdAt)} • ${sale.items.reduce((sum, item) => sum + item.qty, 0)} items`,
    value: money(sale.total, currency),
  }));
  const period = windowMs
    ? `Last ${kind === "Daily" ? "24 hours" : kind === "Weekly" ? "7 days" : "31 days"}`
    : "Current business data";

  if (["Daily", "Weekly", "Monthly", "Sales"].includes(kind)) {
    const average = sales.length ? revenue / sales.length : 0;
    return {
      title: `${kind} report`,
      period: kind === "Sales" ? "All completed sales" : period,
      insight: sales.length
        ? `${sales.length} completed transaction${sales.length === 1 ? "" : "s"} generated ${money(revenue, currency)} in revenue.`
        : "No completed sales are recorded for this period yet.",
      metrics: [
        { label: "Revenue", value: money(revenue, currency) },
        { label: "Gross profit", value: money(grossProfit, currency) },
        { label: "Transactions", value: String(sales.length) },
        { label: "Average sale", value: money(average, currency) },
      ],
      rows: saleRows,
    };
  }

  if (kind === "Profit") {
    return {
      title: "Profit report",
      period,
      insight:
        netEstimate >= 0
          ? `The current net estimate is ${money(netEstimate, currency)} after recorded expenses.`
          : `Recorded costs and expenses currently exceed gross profit by ${money(Math.abs(netEstimate), currency)}.`,
      metrics: [
        { label: "Revenue", value: money(revenue, currency) },
        { label: "Cost of goods", value: money(cost, currency) },
        { label: "Expenses", value: money(expenseTotal, currency) },
        { label: "Net estimate", value: money(netEstimate, currency) },
      ],
      rows: saleRows,
    };
  }

  if (kind === "Inventory") {
    const active = data.products.filter((product) => product.active);
    const units = active.reduce((sum, product) => sum + product.stock, 0);
    const value = active.reduce(
      (sum, product) => sum + product.stock * product.cost,
      0,
    );
    const low = active.filter((product) => product.stock <= product.reorder);
    return {
      title: "Inventory report",
      period,
      insight: low.length
        ? `${low.length} product${low.length === 1 ? " needs" : "s need"} restocking attention.`
        : "Stock levels currently look healthy.",
      metrics: [
        { label: "Active products", value: String(active.length) },
        { label: "Units in stock", value: String(units) },
        { label: "Stock value", value: money(value, currency) },
        { label: "Low stock", value: String(low.length) },
      ],
      rows: active.slice(0, 18).map((product) => ({
        label: product.name,
        detail: `${product.sku || "No SKU"} • reorder at ${product.reorder}`,
        value: `${product.stock} ${product.unit}`,
      })),
    };
  }

  if (kind === "Expenses") {
    const byCategory = expenses.reduce<Record<string, number>>((totals, expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
      return totals;
    }, {});
    const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    return {
      title: "Expenses report",
      period,
      insight: top
        ? `${top[0]} is the largest recorded expense category at ${money(top[1], currency)}.`
        : "No operating expenses have been recorded yet.",
      metrics: [
        { label: "Total expenses", value: money(expenseTotal, currency) },
        { label: "Entries", value: String(expenses.length) },
        { label: "Categories", value: String(Object.keys(byCategory).length) },
        { label: "Largest category", value: top?.[0] || "—" },
      ],
      rows: expenses.slice(0, 18).map((expense) => ({
        label: expense.description,
        detail: `${expense.category} • ${day(expense.date)}`,
        value: money(expense.amount, currency),
      })),
    };
  }

  if (kind === "Customer Credit") {
    const owing = data.customers.filter((customer) => customer.balance > 0);
    const outstanding = owing.reduce((sum, customer) => sum + customer.balance, 0);
    return {
      title: "Customer credit report",
      period,
      insight: owing.length
        ? `${owing.length} customer${owing.length === 1 ? " has" : "s have"} an outstanding balance.`
        : "No customer credit is currently outstanding.",
      metrics: [
        { label: "Outstanding", value: money(outstanding, currency) },
        { label: "Customers owing", value: String(owing.length) },
        { label: "Customer records", value: String(data.customers.length) },
        { label: "Average balance", value: money(owing.length ? outstanding / owing.length : 0, currency) },
      ],
      rows: owing.slice(0, 18).map((customer) => ({
        label: customer.name,
        detail: customer.lastActivity ? `Last activity ${day(customer.lastActivity)}` : "No recent activity",
        value: money(customer.balance, currency),
      })),
    };
  }

  if (kind === "Supplier") {
    const outstanding = data.suppliers.reduce(
      (sum, supplier) => sum + supplier.balance,
      0,
    );
    const purchaseTotal = data.purchases.reduce(
      (sum, purchase) => sum + purchase.total,
      0,
    );
    return {
      title: "Supplier report",
      period,
      insight: outstanding
        ? `Supplier obligations total ${money(outstanding, currency)} across the current supplier book.`
        : "No supplier balance is currently outstanding.",
      metrics: [
        { label: "Suppliers", value: String(data.suppliers.length) },
        { label: "Purchases", value: String(data.purchases.length) },
        { label: "Purchased value", value: money(purchaseTotal, currency) },
        { label: "Outstanding", value: money(outstanding, currency) },
      ],
      rows: data.suppliers.slice(0, 18).map((supplier) => ({
        label: supplier.name,
        detail: supplier.lastActivity ? `Last activity ${day(supplier.lastActivity)}` : "No recent activity",
        value: money(supplier.balance, currency),
      })),
    };
  }

  const requests = data.requests || [];
  const open = requests.filter((request) => request.status === "open");
  const requestedUnits = open.reduce((sum, request) => sum + request.quantity, 0);
  return {
    title: "Customer requests report",
    period,
    insight: open.length
      ? `${open.length} open request${open.length === 1 ? "" : "s"} show products customers could not find.`
      : "There are no open customer product requests.",
    metrics: [
      { label: "Open requests", value: String(open.length) },
      { label: "Requested units", value: String(requestedUnits) },
      { label: "Sourced", value: String(requests.filter((request) => request.status === "sourced").length) },
      { label: "Total records", value: String(requests.length) },
    ],
    rows: requests.slice(0, 18).map((request) => ({
      label: request.product,
      detail: `${request.status} • ${day(request.createdAt)}`,
      value: `${request.quantity} units`,
    })),
  };
}
