import { describe, expect, it } from "vitest";
import type { Business } from "./types";
import type { ReportSnapshot } from "./reports";
import { createBrandedReportPdf } from "./report-pdf";

const business: Business = {
  name: "Titus Brambo Tytus's Shop",
  country: "Uganda",
  currency: "UGX",
  phone: "+256 700 000000",
  email: "shop@example.com",
  address: "Kampala, Uganda",
  taxRate: 0,
  taxEnabled: false,
  lowStockThreshold: 2,
  receiptFooter: "Thank you for shopping with us.",
  paper: "A4",
  theme: "light",
  plan: "business",
};

function snapshot(rows = 4): ReportSnapshot {
  return {
    title: "Weekly report",
    period: "Last 7 days",
    insight:
      "Completed transactions generated UGX 97,170,131 in revenue during this reporting period.",
    metrics: [
      { label: "Revenue", value: "UGX 97,170,131" },
      { label: "Gross profit", value: "UGX 45,170,131" },
      { label: "Transactions", value: String(rows) },
      { label: "Average sale", value: "UGX 24,292,533" },
    ],
    rows: Array.from({ length: rows }, (_, index) => ({
      label: `NS-2026-1208-${String(index + 1).padStart(2, "0")}-03PM`,
      detail: `12 Aug 2026 • ${index + 1} items • Cash`,
      value: `UGX ${((index + 1) * 8_765_789).toLocaleString()}`,
    })),
  };
}

describe("polished PDF reports", () => {
  it("generates a valid branded PDF", () => {
    const pdf = createBrandedReportPdf(
      business,
      snapshot(),
      new Date("2026-08-17T08:14:21.000Z"),
    );
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(3_000);
  });

  it("paginates long tables without losing the report", () => {
    const pdf = createBrandedReportPdf(business, snapshot(30));
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(5_000);
  });
});
