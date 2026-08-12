import { describe, expect, it } from "vitest";
import type { Sale } from "./types";
import { demoData } from "./utils";
import {
  buildCloudSaleRows,
  markSalesSynced,
  mergeCloudSales,
  parseCloudSale,
  salesSyncFingerprint,
} from "./sale-sync";

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    receiptNo: "NS-2026-1108-1PM",
    createdAt: "2026-08-11T13:00:00.000Z",
    cashier: "Titus Tytus",
    items: [
      {
        productId: "product-1",
        name: "Soap",
        price: 5_000,
        originalPrice: 6_000,
        negotiated: true,
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
    synced: false,
    ...overrides,
  };
}

describe("cross-device sale sync", () => {
  it("validates and prepares sales for Supabase", () => {
    const record = sale();
    expect(parseCloudSale(record)?.synced).toBe(true);
    expect(parseCloudSale(record)?.items[0]).toMatchObject({
      negotiated: true,
      originalPrice: 6_000,
      price: 5_000,
    });
    expect(parseCloudSale({ id: "broken" })).toBeNull();
    expect(buildCloudSaleRows([record], "business-1", "user-1")[0]).toMatchObject({
      business_id: "business-1",
      id: record.id,
      updated_by: "user-1",
    });
  });

  it("merges a missing phone sale once and adjusts stock once", () => {
    const data = demoData();
    data.products.push({
      id: "product-1",
      name: "Soap",
      category: "General",
      price: 5_000,
      cost: 3_000,
      sku: "SOAP-1",
      barcode: "1001",
      qr: "SOAP-1",
      stock: 10,
      reorder: 2,
      unit: "piece",
      taxable: false,
      active: true,
      createdAt: "2026-08-01T10:00:00.000Z",
    });

    const firstMerge = mergeCloudSales(data, [sale()]);
    const secondMerge = mergeCloudSales(firstMerge, [sale({ synced: true })]);

    expect(firstMerge.sales).toHaveLength(1);
    expect(firstMerge.products[0].stock).toBe(8);
    expect(secondMerge).toBe(firstMerge);
    expect(secondMerge.products[0].stock).toBe(8);
  });

  it("does not overwrite an offline local update before it uploads", () => {
    const data = demoData();
    data.sales = [sale({ status: "refunded", synced: false })];
    const merged = mergeCloudSales(data, [sale({ status: "completed", synced: true })]);
    expect(merged.sales[0].status).toBe("refunded");
  });

  it("marks only confirmed records as synced without changing the fingerprint", () => {
    const pending = sale();
    const before = salesSyncFingerprint([pending]);
    const data = demoData();
    data.sales = [pending];
    const synced = markSalesSynced(data, new Set([pending.id]));
    expect(synced.sales[0].synced).toBe(true);
    expect(salesSyncFingerprint(synced.sales)).toBe(before);
  });
});
