import { describe, expect, it } from "vitest";
import type { Business, Sale } from "./types";
import {
  businessInitials,
  createReceiptPdf,
  formatReceiptDate,
} from "./receipt-pdf";

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
  paper: "80mm",
  theme: "light",
  plan: "business",
};

const sale: Sale = {
  id: "sale-1",
  receiptNo: "NS-2026-1708-6-15PM",
  createdAt: "2026-08-17T15:15:00.000Z",
  cashier: "Titus",
  customerName: "Walk-in customer",
  items: [
    {
      productId: "product-1",
      name: "My Shop",
      price: 8_765_789,
      originalPrice: 9_000_000,
      negotiated: true,
      cost: 4_000_000,
      qty: 2,
      discount: 0,
    },
  ],
  subtotal: 17_531_578,
  discount: 0,
  tax: 0,
  total: 17_531_578,
  payment: "Cash",
  paid: 50_000_000,
  change: 32_468_422,
  status: "completed",
  synced: true,
};

describe("premium receipt PDF", () => {
  it("uses the business identity for the emblem", () => {
    expect(businessInitials(business.name)).toBe("TB");
    expect(businessInitials("Nile Mart")).toBe("NM");
  });

  it("formats the receipt date with day, month, year and AM/PM", () => {
    expect(formatReceiptDate(sale.createdAt)).toMatch(
      /^17\/08\/2026 \| \d{1,2}:\d{2} (AM|PM)$/,
    );
  });

  it("generates a compact printable receipt", () => {
    const pdf = createReceiptPdf(business, sale);
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(80, 0);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(4_000);
  });

  it("also supports narrow 58mm thermal paper", () => {
    const pdf = createReceiptPdf({ ...business, paper: "58mm" }, sale);
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(58, 0);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(4_000);
  });
});
