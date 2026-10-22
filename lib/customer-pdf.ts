import { jsPDF } from "jspdf";
import type { AppData, Business, Contact } from "./types";
import {
  accountAmount,
  amountReceivedAtSale,
  reconcileCustomerAccounts,
} from "./customer-accounts";
import { day, money } from "./utils";
import {
  CUSTOMER_FONT_REGULAR,
  CUSTOMER_FONT_BOLD,
} from "./customer-pdf-fonts";

type Color = readonly [number, number, number];
const ink: Color = [24, 43, 36];
const muted: Color = [98, 115, 106];
const emerald: Color = [10, 120, 83];
const forest: Color = [6, 63, 49];
const amber: Color = [162, 80, 10];
const margin = 16,
  width = 178,
  bottom = 277,
  lineHeight = 3.8;
type Column = { label: string; width: number; align?: "left" | "right" };
type Cell = { text: string; bold?: boolean; color?: Color };
const clean = (value: string) =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/×/g, "x")
    .replace(/\s*·\s*/g, " | ");

class CustomerPdf {
  pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  y = 62;
  constructor(
    private business: Business,
    private title: string,
    private scope: string,
    private generatedAt: Date,
  ) {
    this.pdf.addFileToVFS("LiberationSans-Regular.ttf", CUSTOMER_FONT_REGULAR);
    this.pdf.addFileToVFS("LiberationSans-Bold.ttf", CUSTOMER_FONT_BOLD);
    this.pdf.addFont("LiberationSans-Regular.ttf", "CustomerSans", "normal");
    this.pdf.addFont("LiberationSans-Bold.ttf", "CustomerSans", "bold");
    this.pdf.setProperties({
      title: `${title} - ${business.name}`,
      author: business.name,
      subject: "NileStock customer records",
      creator: "NileStock",
    });
    this.header();
  }
  fit(
    text: string,
    x: number,
    y: number,
    available: number,
    size = 8,
    align: "left" | "right" = "left",
  ) {
    const pdf = this.pdf;
    text = clean(text);
    while (size > 6.5) {
      pdf.setFontSize(size);
      if (pdf.getTextWidth(text) <= available) break;
      size -= 0.25;
    }
    pdf.setFontSize(size);
    if (pdf.getTextWidth(text) > available) {
      while (text.length && pdf.getTextWidth(`${text}...`) > available)
        text = text.slice(0, -1);
      text = `${text.trimEnd()}...`;
    }
    pdf.text(text, x, y, { align });
  }
  header(continued = false) {
    const pdf = this.pdf;
    pdf.setFillColor(...forest);
    pdf.rect(0, 0, 210, 33, "F");
    pdf.setFillColor(...emerald);
    pdf.rect(0, 33, 210, 1.5, "F");
    pdf.setFillColor(237, 249, 243);
    pdf.roundedRect(16, 9, 12, 12, 3, 3, "F");
    pdf.setFont("CustomerSans", "bold");
    pdf.setTextColor(...forest);
    pdf.setFontSize(8);
    pdf.text(
      this.business.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase(),
      22,
      16.5,
      { align: "center" },
    );
    pdf.setTextColor(255, 255, 255);
    this.fit(this.business.name, 33, 14, 98, 14);
    pdf.setFont("CustomerSans", "normal");
    pdf.setTextColor(203, 231, 219);
    this.fit(
      [this.business.phone, this.business.email].filter(Boolean).join(" | "),
      33,
      21,
      99,
      7.5,
    );
    this.fit("CUSTOMER RECORDS", 194, 13, 55, 8, "right");
    this.fit(
      this.generatedAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      194,
      21,
      52,
      8,
      "right",
    );
    pdf.setFont("CustomerSans", "bold");
    pdf.setTextColor(...ink);
    this.fit(
      `${this.title}${continued ? " - continued" : ""}`,
      16,
      46,
      178,
      20,
    );
    pdf.setFont("CustomerSans", "normal");
    pdf.setTextColor(...muted);
    this.fit(this.scope, 16, 54, 178, 8);
    this.y = 62;
  }
  customer(customer: Contact) {
    const pdf = this.pdf;
    pdf.setFont("CustomerSans", "bold");
    pdf.setFontSize(13);
    const name = pdf.splitTextToSize(clean(customer.name), 162) as string[];
    pdf.setFont("CustomerSans", "normal");
    pdf.setFontSize(8);
    const contacts = pdf.splitTextToSize(
      clean(
        [customer.phone, customer.email, customer.address]
          .filter(Boolean)
          .join(" | "),
      ),
      162,
    ) as string[];
    const height = 17 + name.length * 5.5 + contacts.length * 4;
    pdf.setFillColor(242, 249, 245);
    pdf.setDrawColor(220, 232, 224);
    pdf.roundedRect(margin, this.y, width, height, 3, 3, "FD");
    pdf.setTextColor(...muted);
    pdf.setFontSize(7);
    pdf.text("STATEMENT FOR", 22, this.y + 7);
    pdf.setTextColor(...forest);
    pdf.setFont("CustomerSans", "bold");
    pdf.setFontSize(13);
    pdf.text(name, 22, this.y + 14);
    pdf.setFont("CustomerSans", "normal");
    pdf.setTextColor(...muted);
    pdf.setFontSize(8);
    pdf.text(contacts, 22, this.y + 16 + name.length * 5.5);
    this.y += height + 7;
  }
  metrics(metrics: { label: string; value: string; warning?: boolean }[]) {
    const pdf = this.pdf,
      gap = 3,
      cardWidth = (width - gap * 3) / 4;
    metrics.forEach((metric, index) => {
      const x = margin + index * (cardWidth + gap);
      pdf.setFillColor(
        ...((metric.warning ? [255, 248, 234] : [246, 249, 247]) as [
          number,
          number,
          number,
        ]),
      );
      pdf.setDrawColor(224, 232, 226);
      pdf.roundedRect(x, this.y, cardWidth, 23, 2.5, 2.5, "FD");
      pdf.setFont("CustomerSans", "normal");
      pdf.setTextColor(...muted);
      this.fit(metric.label, x + 4, this.y + 7.5, cardWidth - 8, 7);
      pdf.setFont("CustomerSans", "bold");
      pdf.setTextColor(...(metric.warning ? amber : forest));
      this.fit(metric.value, x + 4, this.y + 16.5, cardWidth - 8, 11.5);
    });
    this.y += 31;
  }
  note(text: string) {
    const pdf = this.pdf;
    pdf.setFont("CustomerSans", "normal");
    pdf.setFontSize(8);
    const lines = pdf.splitTextToSize(clean(text), width) as string[];
    if (this.y + lines.length * 4 + 5 > bottom) {
      pdf.addPage();
      this.header(true);
    }
    pdf.setTextColor(...muted);
    pdf.text(lines, margin, this.y);
    this.y += lines.length * 4 + 6;
  }
  table(columns: Column[], rows: Cell[][]) {
    const pdf = this.pdf;
    const heading = () => {
      pdf.setFillColor(...forest);
      pdf.roundedRect(margin, this.y, width, 9, 2, 2, "F");
      let x = margin;
      pdf.setFont("CustomerSans", "bold");
      pdf.setTextColor(255, 255, 255);
      columns.forEach((column) => {
        this.fit(
          column.label,
          column.align === "right" ? x + column.width - 3 : x + 3,
          this.y + 5.8,
          column.width - 6,
          7,
          column.align,
        );
        x += column.width;
      });
      this.y += 9;
    };
    if (this.y + 22 > bottom) {
      pdf.addPage();
      this.header(true);
    }
    heading();
    rows.forEach((row, index) => {
      const lines = row.map((cell, cellIndex) => {
        pdf.setFont("CustomerSans", cell.bold ? "bold" : "normal");
        pdf.setFontSize(8);
        return pdf.splitTextToSize(
          clean(cell.text),
          columns[cellIndex].width - 6,
        ) as string[];
      });
      const count = Math.max(...lines.map((value) => value.length), 1);
      let offset = 0;
      while (offset < count) {
        const tableBottom = bottom - 17;
        const minimum = Math.min(count - offset, 3) * lineHeight + 6;
        if (this.y + minimum > tableBottom) {
          pdf.addPage();
          this.header(true);
          heading();
        }
        const take = Math.min(
          count - offset,
          Math.floor((tableBottom - this.y - 6) / lineHeight),
        );
        const height = take * lineHeight + 6;
        if (index % 2 === 0) {
          pdf.setFillColor(246, 250, 247);
          pdf.rect(margin, this.y, width, height, "F");
        }
        let x = margin;
        row.forEach((cell, cellIndex) => {
          const column = columns[cellIndex],
            chunk = lines[cellIndex].slice(offset, offset + take);
          pdf.setFont("CustomerSans", cell.bold ? "bold" : "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(...(cell.color || ink));
          if (chunk.length)
            pdf.text(
              chunk,
              column.align === "right" ? x + column.width - 3 : x + 3,
              this.y + 5.6,
              {
                align: column.align || "left",
                lineHeightFactor: lineHeight / (8 * 0.352778),
              },
            );
          x += column.width;
        });
        pdf.setDrawColor(225, 233, 228);
        pdf.line(margin, this.y + height, margin + width, this.y + height);
        this.y += height;
        offset += take;
      }
    });
    this.y += 8;
  }
  finish() {
    const pdf = this.pdf,
      pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      pdf.setPage(page);
      pdf.setDrawColor(214, 225, 219);
      pdf.line(16, 283, 194, 283);
      pdf.setFont("CustomerSans", "normal");
      pdf.setTextColor(...muted);
      this.fit(this.business.name, 16, 290, 65, 7);
      pdf.setFontSize(7);
      pdf.text("Powered by NileStock", 105, 290, { align: "center" });
      pdf.text(`Page ${page} of ${pages}`, 194, 290, { align: "right" });
    }
    return pdf;
  }
}

export function createCustomerDirectoryPdf(
  business: Business,
  customers: Contact[],
  scope = "All customers",
  generatedAt = new Date(),
) {
  const doc = new CustomerPdf(
    business,
    "Customer directory",
    scope,
    generatedAt,
  );
  const due = customers.reduce(
    (sum, customer) => sum + Math.max(0, customer.balance),
    0,
  );
  const owing = customers.filter((customer) => customer.balance > 0).length;
  doc.metrics([
    { label: "Customers", value: String(customers.length) },
    {
      label: "Total purchases",
      value: money(
        customers.reduce((sum, customer) => sum + customer.total, 0),
        business.currency,
      ),
    },
    {
      label: "Outstanding",
      value: money(due, business.currency),
      warning: due > 0,
    },
    { label: "Accounts owing", value: String(owing) },
  ]);
  doc.note(
    `${customers.length} customer${customers.length === 1 ? "" : "s"} in this export. Purchase totals and balances reflect the saved customer accounts. Amounts are in ${business.currency}.`,
  );
  doc.table(
    [
      { label: "#", width: 13 },
      { label: "CUSTOMER / PHONE", width: 48 },
      { label: "EMAIL / ADDRESS", width: 47 },
      { label: "PURCHASES", width: 35, align: "right" },
      { label: "BALANCE", width: 35, align: "right" },
    ],
    customers.map((customer, index) => [
      { text: String(index + 1), color: muted },
      { text: `${customer.name}\n${customer.phone}`, bold: true },
      {
        text: [customer.email || "No email added", customer.address]
          .filter(Boolean)
          .join("\n"),
        color: muted,
      },
      { text: money(customer.total, business.currency), bold: true },
      {
        text: `${money(Math.abs(customer.balance), business.currency)}\n${customer.balance > 0 ? "Owing" : customer.balance < 0 ? "Credit" : "Settled"}`,
        bold: true,
        color: customer.balance > 0 ? amber : emerald,
      },
    ]),
  );
  if (!customers.length) doc.note("No customers match the selected view.");
  return doc.finish();
}

export function buildCustomerStatement(data: AppData, customerId: string) {
  data = reconcileCustomerAccounts(data);
  const customer = data.customers.find((record) => record.id === customerId);
  if (!customer) throw new Error("This customer could not be found.");
  const entries = (data.customerEntries || []).filter(
    (entry) => entry.customerId === customerId,
  );
  const sales = data.sales.filter((sale) => sale.customerId === customerId);
  const transactions = [
    ...sales.map((sale) => ({
      date: sale.createdAt.slice(0, 10),
      at: sale.createdAt,
      title: sale.receiptNo,
      detail: `${sale.status === "completed" ? `Purchase - ${sale.payment}` : `${sale.status} sale (excluded)`}\n${sale.items.map((item) => `${item.qty} x ${item.name}`).join(", ")}`,
      debit: sale.status === "completed" ? sale.total : 0,
      credit:
        sale.status === "completed"
          ? Math.min(sale.total, amountReceivedAtSale(sale))
          : 0,
    })),
    ...entries.map((entry) => ({
      date: entry.date,
      at: entry.createdAt,
      title: entry.kind === "payment" ? "Payment received" : "Opening balance",
      detail: [entry.method, entry.reference, entry.notes]
        .filter(Boolean)
        .join(" | "),
      debit: entry.kind === "opening_balance" ? entry.amount : 0,
      credit: entry.kind === "payment" ? entry.amount : 0,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
  let balance = customer.accountBaseline?.balance || 0;
  const rows = transactions.map((transaction) => {
    balance = accountAmount(balance + transaction.debit - transaction.credit);
    return { ...transaction, balance };
  });
  return {
    customer,
    entries,
    sales,
    opening: customer.accountBaseline?.balance || 0,
    rows,
    closing: balance,
  };
}

export function createCustomerStatementPdf(
  data: AppData,
  customerId: string,
  generatedAt = new Date(),
) {
  const statement = buildCustomerStatement(data, customerId),
    { customer } = statement;
  const currency = data.business.currency;
  const doc = new CustomerPdf(
    data.business,
    "Customer statement",
    `${customer.name} | ${customer.phone} | All saved activity`,
    generatedAt,
  );
  doc.customer(customer);
  doc.metrics([
    { label: "Total purchases", value: money(customer.total, currency) },
    {
      label: "Account payments",
      value: money(
        statement.entries
          .filter((entry) => entry.kind === "payment")
          .reduce((sum, entry) => sum + entry.amount, 0),
        currency,
      ),
    },
    {
      label: "Recorded sales",
      value: String(
        statement.sales.filter((sale) => sale.status === "completed").length,
      ),
    },
    {
      label: customer.balance < 0 ? "Account credit" : "Balance due",
      value: money(Math.abs(customer.balance), currency),
      warning: customer.balance > 0,
    },
  ]);
  doc.note(
    `Debits add purchases or previous debts. Credits show payments received, including amounts paid at checkout. Refunded and voided sales are excluded. Previous activity is included in the balance brought forward. Amounts are in ${currency}.`,
  );
  const rows: Cell[][] = [];
  if (statement.opening)
    rows.push([
      { text: "Prior", color: muted },
      {
        text: "Balance brought forward\nIncludes activity recorded before this statement history",
      },
      {
        text: statement.opening > 0 ? money(statement.opening, currency) : "-",
      },
      {
        text: statement.opening < 0 ? money(-statement.opening, currency) : "-",
      },
      { text: money(statement.opening, currency), bold: true },
    ]);
  rows.push(
    ...statement.rows.map((row) => [
      { text: day(row.date), color: muted },
      { text: `${row.title}\n${row.detail}` },
      { text: row.debit ? money(row.debit, currency) : "-" },
      { text: row.credit ? money(row.credit, currency) : "-", color: emerald },
      {
        text: money(row.balance, currency),
        bold: true,
        color: row.balance > 0 ? amber : emerald,
      },
    ]),
  );
  doc.table(
    [
      { label: "DATE", width: 23 },
      { label: "TRANSACTION / DETAILS", width: 71 },
      { label: "DEBIT", width: 28, align: "right" },
      { label: "CREDIT", width: 28, align: "right" },
      { label: "BALANCE", width: 28, align: "right" },
    ],
    rows,
  );
  doc.note(
    `Closing ${customer.balance < 0 ? "account credit" : "balance due"}: ${money(Math.abs(statement.closing), currency)}.`,
  );
  return doc.finish();
}
