import { describe, expect, it } from "vitest";
import { demoData } from "./utils";
import { escposBytes, printerTestText, rawbtIntent, receiptText } from "./thermal-receipt";
import type { Sale } from "./types";

const business = { ...demoData().business, name: "Café Nile", receiptFooter: "Thank you!" };
const sale: Sale = {
  id: "receipt-test", receiptNo: "NS-TEST-1", createdAt: "2026-10-17T08:00:00Z",
  cashier: "Titus", customerName: "Walk-in", status: "completed", synced: true,
  items: [{ productId: "p1", name: "VeryLongProductName".repeat(6), qty: 2,
    price: 10000, cost: 5000, discount: 1000, negotiated: true }],
  subtotal: 20000, discount: 2000, tax: 0, total: 18000,
  payment: "Mobile Money", paid: 20000, change: 2000,
};

describe("thermal receipt output", () => {
  it.each([["58mm", 32], ["80mm", 48]] as const)("fits %s paper without losing amounts or long names", (paper, columns) => {
    const text = receiptText(business, sale, paper);
    expect(text.split("\n").every((line) => line.length <= columns)).toBe(true);
    expect(text).toContain("Cafe Nile");
    expect(text).toContain("NS-TEST-1");
    expect(text).toContain("18,000");
    expect(text).toContain("2,000");
    expect(text).toContain("Mobile Money");
    expect(text).toContain("[N]");
    expect(text.replace(/\s/g, "")).toContain(sale.items[0].name);
    expect(text).toContain("Powered by NileStock");
  });

  it("never passes embedded printer commands from names, footers or notes", () => {
    const text = receiptText({ ...business, name: "Nile\x1bp\0", receiptFooter: "Thanks\x1dV\x01" },
      { ...sale, note: "\x1b@\n\x1bp\0\x7f" }, "58mm");
    expect(text).not.toMatch(/[\x00-\x09\x0b-\x1f\x7f-\uffff]/);
    const bytes = escposBytes(text);
    expect([...bytes.slice(0, 11)]).toEqual([27, 64, 27, 77, 0, 29, 33, 0, 27, 97, 0]);
    expect([...bytes.slice(11)].every((byte) => byte === 10 || (byte >= 32 && byte <= 126))).toBe(true);
    expect([...bytes.slice(-3)]).toEqual([10, 10, 10]);
  });

  it("encodes exact receipt bytes for the Android app with a fixed store fallback", () => {
    const bytes = escposBytes(receiptText(business, sale, "58mm"));
    const intent = rawbtIntent(bytes);
    const encoded = intent.slice("intent:base64,".length, intent.indexOf("#Intent"));
    expect(Uint8Array.from(atob(encoded), (value) => value.charCodeAt(0))).toEqual(bytes);
    expect(intent).toContain("scheme=rawbt;package=ru.a402d.rawbtprinter;");
    expect(intent).toContain("S.browser_fallback_url=https%3A%2F%2Fplay.google.com");
  });

  it("test output contains no real sale or customer data", () => {
    expect(printerTestText("58mm")).toContain("No sale has been recorded.");
    expect(printerTestText("58mm")).not.toContain(sale.receiptNo);
  });

  it("handles long receipts without overflowing the JS argument stack", () => {
    const bytes = escposBytes("A".repeat(200000));
    expect(bytes.length).toBe(200014);
  });
});
