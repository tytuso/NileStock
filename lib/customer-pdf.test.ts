import { describe, expect, it } from "vitest";
import type { Sale } from "./types";
import { demoData } from "./utils";
import {
  buildCustomerStatement,
  createCustomerDirectoryPdf,
  createCustomerStatementPdf,
} from "./customer-pdf";

function statementData() {
  const data = demoData();
  data.business.name = "Nile Trading Company";
  data.customers = [
    {
      id: "sarah",
      name: "Sarah Nakato",
      phone: "0772123456",
      email: "sarah@example.com",
      address: "Kampala, Uganda",
      total: 0,
      balance: 0,
      accountBaseline: { total: 0, balance: 25000 },
    },
  ];
  const sale: Sale = {
    id: "sale-1",
    receiptNo: "NS-001",
    customerId: "sarah",
    customerName: "Sarah Nakato",
    cashier: "Titus",
    createdAt: "2026-10-20T09:00:00.000Z",
    items: [
      {
        productId: "soap",
        name: "Premium Soap",
        price: 10000,
        cost: 6000,
        qty: 1,
        discount: 0,
      },
    ],
    subtotal: 10000,
    total: 10000,
    tax: 0,
    discount: 0,
    paid: 15000,
    change: 5000,
    payment: "Cash",
    status: "completed",
    synced: true,
  };
  data.sales = [
    sale,
    {
      ...sale,
      id: "sale-2",
      receiptNo: "NS-002",
      payment: "Customer Credit",
      paid: 4000,
      creditPaid: 4000,
      change: 0,
    },
  ];
  data.customerEntries = [
    {
      id: "payment",
      customerId: "sarah",
      kind: "payment",
      amount: 10000,
      method: "Mobile Money",
      reference: "MM-123",
      date: "2026-10-21",
      createdAt: "2026-10-21T09:00:00.000Z",
      createdBy: "Titus",
    },
  ];
  return data;
}

describe("customer PDF exports", () => {
  it("keeps the statement running balance correct for cash change, partial credit and repayments", () => {
    const result = buildCustomerStatement(statementData(), "sarah");
    expect(result.opening).toBe(25000);
    expect(result.rows.map((row) => row.balance)).toEqual([
      25000, 31000, 21000,
    ]);
    expect(result.closing).toBe(result.customer.balance);
    expect(result.rows[0].credit).toBe(10000);
  });
  it("exports every customer across multiple PDF pages", () => {
    const data = statementData();
    const customers = Array.from({ length: 45 }, (_, index) => ({
      ...data.customers[0],
      id: `customer-${index}`,
      name: `Customer ${index + 1} with a longer business name`,
      balance: index * 10000,
    }));
    const pdf = createCustomerDirectoryPdf(data.business, customers);
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(5000);
  });
  it("paginates a statement with long transaction descriptions and a closing balance", () => {
    const data = statementData();
    data.sales = Array.from({ length: 35 }, (_, index) => ({
      ...data.sales[0],
      id: `sale-${index}`,
      receiptNo: `NS-${index + 1}`,
      items: [
        {
          ...data.sales[0].items[0],
          name: "A premium product with a longer item description for the customer statement",
        },
      ],
    }));
    const pdf = createCustomerStatementPdf(data, "sarah");
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(5000);
  });
});
