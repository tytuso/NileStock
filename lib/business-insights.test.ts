import { describe, expect, it } from "vitest";
import { createBusinessInsights, insightDate, insightTimeZone } from "./business-insights";
import { adviserMessages } from "./adviser-chat";
import { demoData } from "./utils";
import type { AppData, Product, Sale } from "./types";

const options = { now: new Date("2026-10-27T12:00:00Z"), timeZone: "Africa/Kampala" };
function product(index = 1, overrides: Partial<Product> = {}): Product {
  return { id: `p${index}`, name: `Product ${index}`, category: "General", price: 100, cost: 30, sku: `SKU-${index}`, barcode: "", qr: "", stock: 10, reorder: 2, unit: "piece", taxable: false, active: true, createdAt: "2026-01-01T00:00:00Z", ...overrides };
}
function sale(overrides: Partial<Sale> = {}): Sale {
  return { id: "sale-1", receiptNo: "NS-TEST", createdAt: "2026-10-27T08:00:00Z", cashier: "Private cashier", items: [{ productId: "p1", name: "Product 1", qty: 1, price: 100, cost: 30, discount: 0 }], subtotal: 100, discount: 0, tax: 0, total: 100, payment: "Cash", paid: 100, change: 0, status: "completed", synced: true, ...overrides };
}
function business(): AppData { return { ...demoData(), products: [product()], sales: [sale()] }; }

describe("business manager calculations", () => {
  it("allocates item and order discounts, excludes tax, and uses historical costs", () => {
    const data = business(); data.business.currency = "USD"; data.products[0].cost = 99;
    data.sales = [sale({ items: [{ productId: "p1", name: "Product 1", qty: 2, price: 100, cost: 30, discount: 10 }, { productId: "p2", name: "Product 2", qty: 1, price: 50, cost: 10, discount: 0 }], subtotal: 250, discount: 50, tax: 36, total: 236, paid: 300, change: 64 })];
    data.expenses = [{ id: "e1", category: "Transport", description: "Delivery", amount: 20, payment: "Cash", date: "2026-10-27" }];
    const r = createBusinessInsights(data, options).report({ period: "today" });
    expect(r.totals).toMatchObject({ recordedSalesIncludingTax: 236, netSalesExcludingTax: 200, recordedCostOfGoods: 70, estimatedGrossProfit: 130, estimatedOperatingProfit: 110, upfrontPaymentsReceived: 236 });
    expect(r.productMetrics.reduce((n, p) => n + p.netSales, 0)).toBeCloseTo(200);
    expect(r.productMetrics.find((p) => p.id === "p1")?.netSales).toBe(156.52);
  });

  it("excludes refunded and voided records from sales, cost and profit", () => {
    const data = business(); data.sales.push(sale({ id: "r", status: "refunded", total: 1000 }), sale({ id: "v", status: "voided", total: 3000 }));
    const r = createBusinessInsights(data, options).report({ period: "today" });
    expect(r.totals).toMatchObject({ completedSales: 1, recordedSalesIncludingTax: 100, recordedCostOfGoods: 30, refundedSalesExcluded: 1, voidedSalesExcluded: 1 });
  });

  it("separates credit revenue, upfront receipts, repayments and change", () => {
    const data = business();
    data.sales = [sale({ payment: "Customer Credit", paid: 100, creditPaid: 20 }), sale({ id: "cash", paid: 120, change: 20 })];
    data.customerEntries = [{ id: "pay", customerId: "c1", kind: "payment", amount: 15, date: "2026-10-27", createdAt: "2026-10-27T08:00:00Z", createdBy: "Owner" }];
    data.purchases = [{ id: "purchase", supplierId: "s1", supplierName: "Private supplier", reference: "P1", date: "2026-10-27", items: [], total: 500, paid: 200 }];
    const r = createBusinessInsights(data, options).report({ period: "today" });
    expect(r.totals).toMatchObject({ recordedSalesIncludingTax: 200, upfrontPaymentsReceived: 120, customerRepaymentsRecorded: 15, supplierPaymentsRecorded: 200, estimatedOperatingProfit: 140 });
    data.sales[0].creditPaid = undefined;
    expect(createBusinessInsights(data, options).report({ period: "today" }).totals.upfrontPaymentsReceived).toBe(100);
  });

  it("uses the owner's calendar day and preserves date-only expense dates", () => {
    const data = business(); data.sales[0].createdAt = "2026-10-26T22:30:00Z";
    data.expenses = [{ id: "old", category: "Other", description: "Yesterday", date: "2026-10-26", amount: 500, payment: "Cash" }];
    expect(createBusinessInsights(data, options).report({ period: "today" }).totals.completedSales).toBe(1);
    expect(createBusinessInsights(data, options).report({ period: "today" }).totals.recordedOperatingExpenses).toBe(0);
    expect(insightDate("2026-02-30", "Africa/Kampala")).toBe("");
    expect(insightTimeZone("not-a-zone")).toBe("Africa/Kampala");
  });

  it("supports exact past-month queries and rejects impossible or reversed ranges", () => {
    const data = business(); data.sales.push(sale({ id: "sep", createdAt: "2026-09-01T08:00:00Z", total: 70 }));
    const insights = createBusinessInsights(data, options);
    expect(insights.report({ period: "lastMonth" }).totals.recordedSalesIncludingTax).toBe(70);
    expect(insights.report({ period: "custom", from: "2026-09-01", to: "2026-09-30" }).totals.recordedSalesIncludingTax).toBe(70);
    expect(() => insights.report({ period: "custom", from: "2026-10-29", to: "2026-10-01" })).toThrow();
    expect(() => insights.report({ period: "custom", from: "2026-10-01", to: "2027-01-01" })).toThrow();
  });

  it("compares matching month-to-date days instead of an entire previous month", () => {
    const data = business(); data.sales.push(sale({ id: "early", createdAt: "2026-09-20T08:00:00Z", total: 50 }), sale({ id: "late", createdAt: "2026-09-30T08:00:00Z", total: 9000 }));
    const r = createBusinessInsights(data, options).summary();
    expect(r.previousMonthComparableDays.range).toEqual({ from: "2026-09-01", to: "2026-09-27" });
    expect(r.previousMonthComparableDays.totals.recordedSalesIncludingTax).toBe(50);
    expect(r.monthComparison.recordedSalesChangePercent).toBe(100);
    expect(createBusinessInsights(data, { now: new Date("2026-03-31T10:00:00Z") }).summary().previousMonthComparableDays.range.to).toBe("2026-02-28");
  });

  it("does not invent percentage growth from a zero or negative baseline", () => {
    const r = createBusinessInsights(business(), options).compare({ period: "thisMonth" }, { period: "lastMonth" });
    expect(r.changes.recordedSalesIncludingTax.percentChange).toBeNull();
    expect(r.changes.recordedSalesIncludingTax.difference).toBe(100);
  });

  it("finds and pages every product beyond the old first-30 limit", () => {
    const data = business(); data.products = Array.from({ length: 65 }, (_, i) => product(i));
    const insights = createBusinessInsights(data, options);
    expect(insights.productInsights({ query: "SKU-64" }).products[0].name).toBe("Product 64");
    expect(insights.productInsights({ offset: 0, limit: 20 }).nextOffset).toBe(20);
    expect(insights.productInsights({ offset: 60, limit: 20 }).products.length).toBe(5);
    expect(insights.productInsights({ offset: 60, limit: 20 }).nextOffset).toBeNull();
  });

  it("includes historically sold products that were removed from the catalog", () => {
    const data = business(); data.products = [];
    const p = createBusinessInsights(data, options).productInsights({ query: "Product 1" }).products[0];
    expect(p).toMatchObject({ inCurrentCatalog: false, active: false, stock: null, unitsSold: 1 });
  });

  it("flags zero costs and separates active stock priorities from archived stock", () => {
    const data = business(); data.products = [product(1, { cost: 0, stock: 1 }), product(2, { stock: 0, active: false })]; data.sales[0].items[0].cost = 0;
    const insights = createBusinessInsights(data, options);
    expect(insights.report({ period: "today" }).warnings.join(" ")).toContain("zero or missing");
    expect(insights.summary().currentInventory.lowStockProducts).toBe(1);
    expect(insights.productInsights({ query: "Product 2" }).products[0].lowStock).toBe(false);
  });

  it("groups all open requests without exposing customer identities", () => {
    const data = business();
    data.requests = Array.from({ length: 25 }, (_, i) => ({ id: `req-${i}`, product: i >= 23 ? "Special soap" : `Product ${i}`, customer: "Private customer", phone: "+256700123456", quantity: 2, status: "open", createdAt: "2026-10-27T10:00:00Z" }));
    const r = createBusinessInsights(data, options).demand("special");
    expect(r.requests).toEqual([{ product: "Special soap", quantity: 4, requests: 2 }]);
    expect(JSON.stringify(createBusinessInsights(data, options).summary())).not.toContain("+256700123456");
    expect(JSON.stringify(r)).not.toContain("Private customer");
  });

  it("evaluates a discount using contribution profit and labels its assumptions", () => {
    const data = business(); data.products[0].cost = 60;
    const insights = createBusinessInsights(data, options);
    expect(insights.priceScenario("p1", 80, 10)).toMatchObject({ proposedUnitGrossProfit: 20, proposedGrossProfitAtAssumedUnits: 200, unitsNeededToMatchCurrentGrossProfit: 20 });
    expect(insights.priceScenario("p1", 50, 10)).toMatchObject({ proposedUnitGrossProfit: -10, unitsNeededToMatchCurrentGrossProfit: null });
    expect(insights.priceScenario("missing", 50, 10)).toHaveProperty("error");
    expect(insights.priceScenario("p1", 1e12, 1e8)).toHaveProperty("error");
    expect(data.products[0].price).toBe(100);
  });

  it("shows missing history and excludes invalid sale dates", () => {
    const data = business(); data.sales.push(sale({ id: "bad", createdAt: "not-a-date" }));
    const insights = createBusinessInsights(data, options);
    expect(insights.report({ period: "last30Days" }).warnings.join(" ")).toContain("history starts");
    expect(insights.summary().coverage.invalidSaleDatesExcluded).toBe(1);
    expect(insights.report({ period: "lastMonth" }).totals.completedSales).toBe(0);
  });

  it("keeps follow-up context beyond eight turns while bounding message size", () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: `Message ${i}` }));
    expect(adviserMessages(messages)).toHaveLength(20);
    expect(adviserMessages(messages)[0].content).toBe("Message 10");
    const large = adviserMessages(messages.map((m) => ({ ...m, content: "x".repeat(10_000) })));
    expect(large.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(20_000);
  });
});
