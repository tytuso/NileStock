import type { AppData } from "./types";

export type ReportDateRange = { from: string; to: string };
export type ReportPreset = "all" | "today" | "week" | "month";

/** Calendar dates use the same device-local time as the dates displayed in the app. */
export function reportDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && reportDate(date) === value;
}

export function reportRangeError(range: ReportDateRange) {
  if (
    (range.from && !validDate(range.from)) ||
    (range.to && !validDate(range.to))
  )
    return "Enter a valid start and end date.";
  if (range.from && range.to && range.from > range.to)
    return "The end date must be on or after the start date.";
  return "";
}

export function reportPresetRange(
  preset: ReportPreset,
  today = new Date(),
): ReportDateRange {
  if (preset === "all") return { from: "", to: "" };
  const start = new Date(today);
  if (preset === "week") start.setDate(start.getDate() - 6);
  if (preset === "month") start.setDate(1);
  return { from: reportDate(start), to: reportDate(today) };
}

export function isInReportRange(value: string, range: ReportDateRange) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : reportDate(new Date(value));
  return (
    validDate(date) &&
    (!range.from || date >= range.from) &&
    (!range.to || date <= range.to)
  );
}

export function reportDisplayDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return date.toLocaleDateString("en-UG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function reportPeriodLabel(range: ReportDateRange) {
  const format = reportDisplayDate;
  if (range.from && range.to)
    return range.from === range.to
      ? format(range.from)
      : `${format(range.from)} - ${format(range.to)}`;
  if (range.from) return `From ${format(range.from)}`;
  if (range.to) return `Through ${format(range.to)}`;
  return "All time";
}

export function reportPeriodFilename(range: ReportDateRange) {
  return range.from || range.to
    ? `${range.from || "start"}-to-${range.to || "latest"}`
    : "all-time";
}

export function selectReportPeriod(data: AppData, range: ReportDateRange) {
  const error = reportRangeError(range);
  if (error) throw new RangeError(error);
  const sales = data.sales.filter(
    (sale) =>
      sale.status === "completed" && isInReportRange(sale.createdAt, range),
  );
  const expenses = data.expenses.filter((expense) =>
    isInReportRange(expense.date, range),
  );
  const revenue = sales.reduce((total, sale) => total + sale.total, 0);
  const cost = sales.reduce(
    (total, sale) =>
      total + sale.items.reduce((sum, item) => sum + item.cost * item.qty, 0),
    0,
  );
  const expense = expenses.reduce((total, entry) => total + entry.amount, 0);
  return {
    sales,
    expenses,
    revenue,
    cost,
    expense,
    grossProfit: revenue - cost,
    netProfit: revenue - cost - expense,
  };
}
