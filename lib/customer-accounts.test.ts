import { describe, expect, it } from "vitest";
import type { CustomerAccountEntry, Sale } from "./types";
import { demoData } from "./utils";
import {
  amountReceivedAtSale,
  creditSaleBalance,
  recordCustomerEntry,
  reconcileCustomerAccounts,
  saveCustomerDetails,
} from "./customer-accounts";
import { mergeWorkspaceChanges } from "./workspace-backup";
import { mergeCloudSales } from "./sale-sync";

const at = "2026-10-20T09:00:00.000Z";
const details = { id: "sarah", name: "Sarah Nakato", phone: "0772123456" };
const account = () => saveCustomerDetails(demoData(), details, "Titus");
const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: "sale-1",
  receiptNo: "NS-1",
  createdAt: at,
  customerId: "sarah",
  customerName: "Sarah Nakato",
  cashier: "Titus",
  items: [
    {
      productId: "soap",
      name: "Soap",
      price: 10000,
      cost: 6000,
      qty: 1,
      discount: 0,
    },
  ],
  subtotal: 10000,
  discount: 0,
  tax: 0,
  total: 10000,
  paid: 10000,
  change: 0,
  payment: "Customer Credit",
  status: "completed",
  synced: true,
  ...overrides,
});
const entry = (
  overrides: Partial<CustomerAccountEntry> = {},
): CustomerAccountEntry => ({
  id: "entry-1",
  customerId: "sarah",
  kind: "opening_balance",
  amount: 50000,
  date: "2026-10-20",
  createdAt: at,
  createdBy: "Titus",
  ...overrides,
});

describe("customer accounts", () => {
  it("preserves repayments made by an older app while another device uses the ledger", () => {
    const base = recordCustomerEntry(account(), entry());
    const local = recordCustomerEntry(
      base,
      entry({
        id: "new-payment",
        kind: "payment",
        amount: 10000,
        method: "Cash",
      }),
    );
    const remote = {
      ...base,
      customers: base.customers.map((customer) => ({
        ...customer,
        balance: customer.balance - 20000,
      })),
    };
    const merged = mergeWorkspaceChanges(base, local, remote);
    expect(merged.customers[0].balance).toBe(20000);
    expect(reconcileCustomerAccounts(merged)).toBe(merged);
  });
  it("preserves all legacy totals and previous repayments during migration", () => {
    const data = demoData();
    data.customers = [{ ...details, total: 180000, balance: 35000 }];
    data.sales = [sale({ total: 100000 })];
    const migrated = reconcileCustomerAccounts(data);
    expect(migrated.customers[0]).toMatchObject({
      total: 180000,
      balance: 35000,
    });
    expect(reconcileCustomerAccounts(migrated)).toBe(migrated);
    const paid = recordCustomerEntry(
      migrated,
      entry({ kind: "payment", amount: 10000, method: "Cash" }),
    );
    expect(paid.customers[0]).toMatchObject({ total: 180000, balance: 25000 });
  });

  it("adds old debt without creating sales or changing inventory and reports", () => {
    const data = account();
    const withDebt = recordCustomerEntry(data, entry());
    expect(withDebt.customers[0]).toMatchObject({ balance: 50000, total: 0 });
    expect(withDebt.sales).toBe(data.sales);
    expect(withDebt.products).toBe(data.products);
    expect(withDebt.movements).toBe(data.movements);
    expect(withDebt.customerEntries?.[0]).toMatchObject({
      kind: "opening_balance",
      amount: 50000,
    });
    expect(recordCustomerEntry(withDebt, entry())).toBe(withDebt);
  });

  it("records partial and full repayments with references, dates and methods", () => {
    const data = recordCustomerEntry(account(), entry());
    const partial = recordCustomerEntry(
      data,
      entry({
        id: "payment-1",
        kind: "payment",
        amount: 30000,
        method: "Mobile Money",
        reference: " MM-123 ",
      }),
    );
    expect(partial.customers[0].balance).toBe(20000);
    expect(partial.customerEntries?.[0].reference).toBe("MM-123");
    const settled = recordCustomerEntry(
      partial,
      entry({
        id: "payment-2",
        kind: "payment",
        amount: 20000,
        method: "Cash",
      }),
    );
    expect(settled.customers[0].balance).toBe(0);
    expect(settled.customerEntries).toHaveLength(3);
  });

  it("rejects overpayments and invalid amounts and dates without changing records", () => {
    const data = recordCustomerEntry(account(), entry());
    for (const amount of [-1, 0, NaN, Infinity])
      expect(() =>
        recordCustomerEntry(data, entry({ id: "invalid", amount })),
      ).toThrow();
    expect(() =>
      recordCustomerEntry(data, entry({ id: "invalid", date: "2026-02-30" })),
    ).toThrow("valid transaction date");
    expect(() =>
      recordCustomerEntry(
        data,
        entry({
          id: "invalid",
          kind: "payment",
          amount: 60000,
          method: "Cash",
        }),
      ),
    ).toThrow("exceeds");
    expect(data.customers[0].balance).toBe(50000);
    expect(data.customerEntries).toHaveLength(1);
  });

  it("edits a customer without losing their sales, debt or payment records", () => {
    const original = recordCustomerEntry(account(), entry());
    const edited = saveCustomerDetails(
      original,
      {
        ...details,
        name: " Sarah N. ",
        email: " sarah@example.com ",
        notes: "Delivery on Fridays",
      },
      "Titus",
    );
    expect(edited.customers).toHaveLength(1);
    expect(edited.customers[0]).toMatchObject({
      name: "Sarah N.",
      email: "sarah@example.com",
      balance: 50000,
    });
    expect(edited.customerEntries).toBe(original.customerEntries);
    expect(edited.sales).toBe(original.sales);
  });

  it("charges only the unpaid portion of a new credit sale and understands old sales", () => {
    const data = account();
    const partial = sale({ paid: 4000, creditPaid: 4000 });
    const result = reconcileCustomerAccounts({ ...data, sales: [partial] });
    expect(result.customers[0]).toMatchObject({ total: 10000, balance: 6000 });
    expect(creditSaleBalance(sale())).toBe(10000);
    expect(amountReceivedAtSale(sale())).toBe(0);
    expect(amountReceivedAtSale(partial)).toBe(4000);
  });

  it("merges separate offline payments once and retains the correct balance", () => {
    const base = recordCustomerEntry(account(), entry());
    const local = recordCustomerEntry(
      base,
      entry({
        id: "local-payment",
        kind: "payment",
        amount: 10000,
        method: "Cash",
      }),
    );
    const remote = recordCustomerEntry(
      base,
      entry({
        id: "remote-payment",
        kind: "payment",
        amount: 20000,
        method: "Bank",
      }),
    );
    const merged = mergeWorkspaceChanges(base, local, remote);
    expect(merged.customerEntries).toHaveLength(3);
    expect(merged.customers[0].balance).toBe(20000);
    expect(
      mergeWorkspaceChanges(remote, merged, remote).customers[0].balance,
    ).toBe(20000);
  });

  it("merges a sale and a payment made on separate devices", () => {
    const base = recordCustomerEntry(account(), entry());
    const local = recordCustomerEntry(
      base,
      entry({
        id: "local-payment",
        kind: "payment",
        amount: 10000,
        method: "Cash",
      }),
    );
    const remote = reconcileCustomerAccounts({
      ...base,
      sales: [sale({ paid: 4000, creditPaid: 4000 })],
    });
    const merged = mergeWorkspaceChanges(base, local, remote);
    expect(merged.customers[0]).toMatchObject({ total: 10000, balance: 46000 });
  });

  it("keeps contact edits when a second device only records a payment", () => {
    const base = recordCustomerEntry(account(), entry());
    const local = saveCustomerDetails(
      base,
      { ...details, phone: "0700111222", notes: "Deliver to shop" },
      "Titus",
    );
    const remote = recordCustomerEntry(
      base,
      entry({
        id: "remote-payment",
        kind: "payment",
        amount: 20000,
        method: "Bank",
      }),
    );
    expect(
      mergeWorkspaceChanges(base, local, remote).customers[0],
    ).toMatchObject({
      phone: "0700111222",
      notes: "Deliver to shop",
      balance: 30000,
    });
  });

  it("syncs a partially paid sale and its refund without double counting debt", () => {
    const data = account();
    const partial = sale({ paid: 4000, creditPaid: 4000 });
    const synced = mergeCloudSales(data, [partial]);
    expect(synced.customers[0]).toMatchObject({ total: 10000, balance: 6000 });
    expect(mergeCloudSales(synced, [partial])).toBe(synced);
    const paid = recordCustomerEntry(
      synced,
      entry({ kind: "payment", amount: 6000, method: "Cash" }),
    );
    const refunded = mergeCloudSales(paid, [
      { ...partial, status: "refunded" },
    ]);
    expect(refunded.customers[0]).toMatchObject({ total: 0, balance: -6000 });
    expect(refunded.customerEntries).toHaveLength(1);
  });

  it("rounds fractional account payments to avoid floating point balances", () => {
    const debt = recordCustomerEntry(account(), entry({ amount: 0.3 }));
    const first = recordCustomerEntry(
      debt,
      entry({ id: "first", kind: "payment", amount: 0.1, method: "Cash" }),
    );
    const settled = recordCustomerEntry(
      first,
      entry({ id: "second", kind: "payment", amount: 0.2, method: "Cash" }),
    );
    expect(settled.customers[0].balance).toBe(0);
  });
});
