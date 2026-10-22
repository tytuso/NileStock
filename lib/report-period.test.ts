import { afterEach, describe, expect, it } from "vitest";
import { demoData, money } from "./utils";
import type { Sale } from "./types";
import { buildPerformanceReport, buildReportSnapshot } from "./reports";
import {
  isInReportRange,
  reportDisplayDate,
  reportPeriodLabel,
  reportPresetRange,
  reportRangeError,
  selectReportPeriod,
} from "./report-period";

const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});
const range = { from: "2026-10-02", to: "2026-10-05" };
const sale = (
  id: string,
  createdAt: string,
  status: Sale["status"] = "completed",
): Sale => ({
  id,
  receiptNo: `NS-${id}`,
  createdAt,
  status,
  cashier: "Titus",
  items: [
    {
      productId: "soap",
      name: "Soap",
      price: 10000,
      cost: 6000,
      qty: 2,
      discount: 0,
    },
  ],
  subtotal: 20000,
  discount: 0,
  tax: 0,
  total: 20000,
  paid: 20000,
  change: 0,
  payment: "Cash",
  synced: true,
});
function fixture() {
  const data = demoData();
  data.sales = [
    sale("before", "2026-10-01T23:59:59+03:00"),
    sale("start", "2026-10-02T00:00:00+03:00"),
    sale("end", "2026-10-05T23:59:59.999+03:00"),
    sale("after", "2026-10-06T00:00:00+03:00"),
    sale("refund", "2026-10-03T12:00:00+03:00", "refunded"),
    sale("void", "2026-10-04T12:00:00+03:00", "voided"),
  ];
  data.expenses = [
    {
      id: "e1",
      description: "Transport",
      category: "Transport",
      date: "2026-10-02",
      amount: 3000,
      payment: "Cash",
    },
    {
      id: "e2",
      description: "Rent",
      category: "Rent",
      date: "2026-10-05",
      amount: 5000,
      payment: "Cash",
    },
    {
      id: "e3",
      description: "Outside",
      category: "Other",
      date: "2026-10-06",
      amount: 50000,
      payment: "Cash",
    },
  ];
  return data;
}

describe("reporting periods", () => {
  it("includes both full boundary days and uses the same period for revenue, costs and expenses", () => {
    process.env.TZ = "Africa/Kampala";
    const data = fixture(),
      before = JSON.stringify(data);
    const result = selectReportPeriod(data, range);
    expect(result.sales.map((sale) => sale.id)).toEqual(["start", "end"]);
    expect(result.expenses.map((expense) => expense.id)).toEqual(["e1", "e2"]);
    expect(result).toMatchObject({
      revenue: 40000,
      cost: 24000,
      expense: 8000,
      grossProfit: 16000,
      netProfit: 8000,
    });
    expect(JSON.stringify(data)).toBe(before);
  });

  it("handles a single day, open-ended ranges and clearing the dates", () => {
    process.env.TZ = "Africa/Kampala";
    const data = fixture();
    expect(
      selectReportPeriod(data, {
        from: "2026-10-02",
        to: "2026-10-02",
      }).sales.map((s) => s.id),
    ).toEqual(["start"]);
    expect(
      selectReportPeriod(data, { from: "2026-10-05", to: "" }).sales.map(
        (s) => s.id,
      ),
    ).toEqual(["end", "after"]);
    expect(
      selectReportPeriod(data, { from: "", to: "2026-10-02" }).sales.map(
        (s) => s.id,
      ),
    ).toEqual(["before", "start"]);
    expect(selectReportPeriod(data, { from: "", to: "" }).revenue).toBe(80000);
    expect(
      selectReportPeriod(data, { from: "2027-01-01", to: "2027-01-31" }),
    ).toMatchObject({ revenue: 0, cost: 0, expense: 0, netProfit: 0 });
  });

  it("uses displayed local dates for timestamped sales while keeping date-only expenses on their calendar day", () => {
    process.env.TZ = "America/Los_Angeles";
    const selected = { from: "2026-03-08", to: "2026-03-08" };
    expect(isInReportRange("2026-03-08T07:59:59Z", selected)).toBe(false);
    expect(isInReportRange("2026-03-08T08:00:00Z", selected)).toBe(true);
    expect(isInReportRange("2026-03-09T06:59:59.999Z", selected)).toBe(true);
    expect(isInReportRange("2026-03-09T07:00:00Z", selected)).toBe(false);
    expect(isInReportRange("2026-03-08", selected)).toBe(true);
    expect(reportDisplayDate("2026-03-08")).toMatch(/08 Mar 2026/);
  });

  it("validates real calendar dates and rejects reversed ranges", () => {
    expect(reportRangeError({ from: "2026-02-30", to: "" })).toBeTruthy();
    expect(reportRangeError({ from: "2024-02-29", to: "2024-03-01" })).toBe("");
    expect(reportRangeError({ from: range.to, to: range.from })).toMatch(
      /end date/,
    );
    expect(() =>
      selectReportPeriod(fixture(), { from: range.to, to: range.from }),
    ).toThrow(RangeError);
    expect(isInReportRange("not-a-date", range)).toBe(false);
    expect(isInReportRange("2026-02-30", { from: "", to: "" })).toBe(false);
  });

  it("offers calendar-day shortcuts across a month/year boundary", () => {
    const today = new Date(2026, 0, 3, 17, 30);
    expect(reportPresetRange("today", today)).toEqual({
      from: "2026-01-03",
      to: "2026-01-03",
    });
    expect(reportPresetRange("week", today)).toEqual({
      from: "2025-12-28",
      to: "2026-01-03",
    });
    expect(reportPresetRange("month", today)).toEqual({
      from: "2026-01-01",
      to: "2026-01-03",
    });
    expect(reportPresetRange("all", today)).toEqual({ from: "", to: "" });
  });

  it("labels the exact period, including one-sided selections", () => {
    expect(reportPeriodLabel(range)).toBe("02 Oct 2026 - 05 Oct 2026");
    expect(reportPeriodLabel({ from: range.from, to: range.from })).toBe(
      "02 Oct 2026",
    );
    expect(reportPeriodLabel({ from: range.from, to: "" })).toBe(
      "From 02 Oct 2026",
    );
    expect(reportPeriodLabel({ from: "", to: range.to })).toBe(
      "Through 05 Oct 2026",
    );
    expect(reportPeriodLabel({ from: "", to: "" })).toBe("All time");
  });

  it("keeps PDF performance and specialist report totals consistent with the selected period", () => {
    process.env.TZ = "Africa/Kampala";
    const data = fixture();
    const performance = buildPerformanceReport(data, range);
    expect(performance.period).toBe("02 Oct 2026 - 05 Oct 2026");
    expect(performance.metrics.map((metric) => metric.value)).toEqual(
      [40000, 16000, 8000, 8000].map((value) => money(value)),
    );
    expect(performance.rows.map((row) => row.label).sort()).toEqual(
      ["NS-start", "NS-end", "Transport", "Rent"].sort(),
    );
    const profit = buildReportSnapshot(data, "Profit", range);
    expect(profit.metrics.map((metric) => metric.value)).toEqual(
      [40000, 24000, 8000, 8000].map((value) => money(value)),
    );
    expect(buildReportSnapshot(data, "Sales", range).rows).toHaveLength(2);
    expect(buildReportSnapshot(data, "Expenses", range).rows).toHaveLength(2);
  });

  it("exports every selected transaction rather than only the first eighteen", () => {
    process.env.TZ = "Africa/Kampala";
    const data = fixture();
    data.sales = Array.from({ length: 45 }, (_, index) =>
      sale(String(index), "2026-10-03T12:00:00Z"),
    );
    expect(buildReportSnapshot(data, "Sales", range).rows).toHaveLength(45);
    expect(buildPerformanceReport(data, range).rows).toHaveLength(47);
  });

  it("keeps live balances out of historical date filtering", () => {
    const data = fixture();
    data.customers = [
      { id: "c", name: "Customer", phone: "", balance: 50000, total: 90000 },
    ];
    const report = buildReportSnapshot(data, "Customer Credit", range);
    expect(report.period).toBe("Current business data");
    expect(report.metrics[0].value).toBe(money(50000));
  });
});
