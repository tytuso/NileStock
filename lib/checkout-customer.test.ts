import { describe, expect, it } from "vitest";
import { resolveCheckoutCustomer } from "./checkout-customer";
import { reconcileCustomerAccounts, saveCustomerDetails } from "./customer-accounts";
import { demoData } from "./utils";
import type { Sale } from "./types";

const at = "2026-11-01T10:00:00.000Z";
const generateId = () => "quick-customer";

describe("quick customer checkout", () => {
  it("creates a name-only record with consistent formatting", () => {
    const result = resolveCheckoutCustomer([], { newCustomerName: "  Sarah   Nakato  " }, at, generateId);
    expect(result).toMatchObject({
      customerId: "quick-customer", customerName: "Sarah Nakato",
      newCustomer: { phone: "", total: 0, balance: 0 },
    });
  });
  it("handles walk-in and saved customers without duplication", () => {
    expect(resolveCheckoutCustomer([], {}, at, generateId).newCustomer).toBeNull();
    const record = { id: "known", name: "Sarah", phone: "", total: 0, balance: 0 };
    expect(resolveCheckoutCustomer([record], { customerId: "known" }, at, generateId))
      .toEqual({ customerId: "known", customerName: "Sarah", newCustomer: null });
    expect(() => resolveCheckoutCustomer([record], { newCustomerName: " SARAH " }, at, generateId))
      .toThrow(/already saved/);
    expect(() => resolveCheckoutCustomer([record], { customerId: "deleted" }, at, generateId))
      .toThrow(/no longer available/);
  });
  it("links a partial credit sale to the new account, including debt", () => {
    const data = demoData();
    const selection = resolveCheckoutCustomer(data.customers, { newCustomerName: "Quick Buyer" }, at, generateId);
    const sale: Sale = {
      id: "sale-1", receiptNo: "NS-1", createdAt: at,
      customerId: selection.customerId, customerName: selection.customerName,
      cashier: "Cashier", items: [], subtotal: 50000, discount: 0, tax: 0,
      total: 50000, payment: "Customer Credit", paid: 10000, creditPaid: 10000,
      change: 0, status: "completed", synced: false,
    };
    const updated = reconcileCustomerAccounts({
      ...data, customers: [selection.newCustomer!, ...data.customers],
      sales: [sale, ...data.sales],
    });
    expect(updated.customers.find((customer) => customer.id === selection.customerId))
      .toMatchObject({ name: "Quick Buyer", total: 50000, balance: 40000 });
    expect(saveCustomerDetails(updated,
      { id: selection.customerId!, name: "Edited", phone: "" }, "Cashier"
    ).customers[0].name).toBe("Edited");
  });
});
