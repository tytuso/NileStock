import { describe, expect, it } from "vitest";
import type { AppData } from "./types";
import {
  PLAN_ACCESS,
  PLAN_DEFINITIONS,
  hasMinimumPlan,
  isProPlan,
  productLimit,
  receiptHistoryLimit,
} from "./plans";
import { buildReportSnapshot } from "./reports";

const baseData = {
  business: {
    name: "Test Shop",
    country: "Uganda",
    currency: "UGX",
    phone: "",
    email: "",
    address: "",
    taxRate: 0,
    taxEnabled: false,
    lowStockThreshold: 2,
    receiptFooter: "",
    paper: "80mm",
    theme: "light",
    plan: "pro",
  },
  products: [
    {
      id: "p1",
      name: "Rice",
      category: "Food",
      price: 5_000,
      cost: 3_000,
      sku: "RICE",
      barcode: "1",
      qr: "1",
      stock: 2,
      reorder: 3,
      unit: "bag",
      taxable: false,
      active: true,
      createdAt: new Date().toISOString(),
    },
  ],
  sales: [
    {
      id: "s1",
      receiptNo: "NS-001",
      createdAt: new Date().toISOString(),
      cashier: "Owner",
      items: [
        {
          productId: "p1",
          name: "Rice",
          price: 5_000,
          cost: 3_000,
          qty: 2,
          discount: 0,
        },
      ],
      subtotal: 10_000,
      discount: 0,
      tax: 0,
      total: 10_000,
      payment: "Cash",
      paid: 10_000,
      change: 0,
      status: "completed",
      synced: true,
    },
  ],
  expenses: [],
  customers: [],
  suppliers: [],
  purchases: [],
  movements: [],
  staff: [],
  audit: [],
  shifts: [],
  held: [],
  requests: [],
  onboarded: true,
} satisfies AppData;

describe("Pro access", () => {
  it("keeps AI exclusive to Pro while Business unlocks PDF reports", () => {
    expect(isProPlan("business")).toBe(false);
    expect(isProPlan("pro")).toBe(true);
    expect(PLAN_ACCESS.filter((item) => item.minimum === "pro")).toHaveLength(1);
    expect(hasMinimumPlan("business", "business")).toBe(true);
    expect(hasMinimumPlan("starter", "business")).toBe(false);
    expect(PLAN_DEFINITIONS.pro.features.join(" ")).toContain("AI");
  });

  it("unlocks barcode downloads from Lite", () => {
    expect(hasMinimumPlan("free", "starter")).toBe(false);
    expect(hasMinimumPlan("starter", "starter")).toBe(true);
    expect(PLAN_DEFINITIONS.starter.price).toBe(9_500);
    expect(PLAN_DEFINITIONS.business.price).toBe(49_500);
    expect(PLAN_DEFINITIONS.pro.price).toBe(99_500);
    expect(productLimit("free")).toBe(10);
    expect(productLimit("starter")).toBe(400);
    expect(productLimit("business")).toBeNull();
  });

  it("increases receipt history by plan without removing sales records", () => {
    expect(receiptHistoryLimit("free")).toBe(20);
    expect(receiptHistoryLimit("starter")).toBe(20);
    expect(receiptHistoryLimit("business")).toBe(50);
    expect(receiptHistoryLimit("pro")).toBe(100);
  });

  it("builds a readable daily report from actual business records", () => {
    const report = buildReportSnapshot(baseData, "Daily");
    expect(report.title).toBe("Daily report");
    expect(report.metrics.find((metric) => metric.label === "Revenue")?.value).toContain("10,000");
    expect(report.rows[0].label).toBe("NS-001");
    expect(report.rows[0].value).toContain("10,000");
  });

  it("builds inventory attention from current stock", () => {
    const report = buildReportSnapshot(baseData, "Inventory");
    expect(report.metrics).toContainEqual({ label: "Low stock", value: "1" });
    expect(report.insight).toContain("restocking attention");
  });
});
