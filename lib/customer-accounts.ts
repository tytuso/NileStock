import type { AppData, Contact, CustomerAccountEntry, Sale } from "./types";
import { now, uid } from "./utils";

export const accountAmount = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** Older credit sales incorrectly stored paid=total; only creditPaid is reliable. */
export function creditSaleBalance(sale: Sale) {
  return sale.payment === "Customer Credit"
    ? accountAmount(
        sale.total - Math.min(sale.total, Math.max(0, sale.creditPaid || 0)),
      )
    : 0;
}

export function amountReceivedAtSale(sale: Sale) {
  return sale.payment === "Customer Credit" ? sale.creditPaid || 0 : sale.paid;
}

/**
 * Keep old account totals exactly as they were, then derive every new balance
 * from sales and ledger entries. This also reconciles independent offline
 * payments after a workspace merge instead of losing one cached balance edit.
 */
export function reconcileCustomerAccounts(
  data: AppData,
  { preserveStoredBalances = false } = {},
): AppData {
  const totals = new Map<
    string,
    { purchases: number; balance: number; last: string }
  >();
  const get = (id: string) => {
    if (!totals.has(id)) totals.set(id, { purchases: 0, balance: 0, last: "" });
    return totals.get(id)!;
  };
  for (const sale of data.sales) {
    if (!sale.customerId) continue;
    const account = get(sale.customerId);
    if (sale.status === "completed") {
      account.purchases += sale.total;
      account.balance += creditSaleBalance(sale);
    }
    if (sale.createdAt > account.last) account.last = sale.createdAt;
  }
  for (const entry of data.customerEntries || []) {
    const account = get(entry.customerId);
    account.balance += entry.kind === "payment" ? -entry.amount : entry.amount;
    if (entry.createdAt > account.last) account.last = entry.createdAt;
  }
  let changed = false;
  const customers = data.customers.map((customer) => {
    const account = get(customer.id);
    const storedBaseline = customer.accountBaseline;
    // An older open app may still record a repayment by changing the cached
    // balance. Preserve it when importing a complete stored snapshot, while
    // new in-memory mutations always derive their totals from the ledger.
    const legacyEdit =
      preserveStoredBalances &&
      storedBaseline &&
      (accountAmount(storedBaseline.total + account.purchases) !==
        customer.total ||
        accountAmount(storedBaseline.balance + account.balance) !==
          customer.balance);
    const baseline = (!legacyEdit && storedBaseline) || {
      total: accountAmount(customer.total - account.purchases),
      balance: accountAmount(customer.balance - account.balance),
    };
    const total = accountAmount(baseline.total + account.purchases);
    const balance = accountAmount(baseline.balance + account.balance);
    const lastActivity =
      [customer.lastActivity || "", account.last].sort().at(-1) || undefined;
    if (
      customer.accountBaseline === baseline &&
      customer.total === total &&
      customer.balance === balance &&
      customer.lastActivity === lastActivity
    )
      return customer;
    changed = true;
    return {
      ...customer,
      accountBaseline: baseline,
      total,
      balance,
      lastActivity,
    };
  });
  return changed ? { ...data, customers } : data;
}

export type CustomerDetails = Pick<
  Contact,
  "id" | "name" | "phone" | "email" | "address" | "notes"
>;

export function saveCustomerDetails(
  data: AppData,
  details: CustomerDetails,
  actor: string,
): AppData {
  data = reconcileCustomerAccounts(data);
  const name = details.name.trim();
  const phone = details.phone.trim();
  if (!name || !phone)
    throw new Error("Enter the customer's name and phone number.");
  const existing = data.customers.find(
    (customer) => customer.id === details.id,
  );
  const customer: Contact = {
    ...(existing || {
      balance: 0,
      total: 0,
      accountBaseline: { total: 0, balance: 0 },
      lastActivity: now(),
    }),
    ...details,
    name,
    phone,
    email: details.email?.trim() || "",
    address: details.address?.trim() || "",
    notes: details.notes?.trim() || "",
  };
  return {
    ...data,
    customers: existing
      ? data.customers.map((record) =>
          record.id === customer.id ? customer : record,
        )
      : [customer, ...data.customers],
    audit: [
      {
        id: uid(),
        actor,
        action: existing ? "Customer details updated" : "Customer created",
        record: name,
        createdAt: now(),
      },
      ...data.audit,
    ],
  };
}

const methods = new Set(["Cash", "Mobile Money", "Card", "Bank", "Other"]);

export function recordCustomerEntry(
  data: AppData,
  entry: CustomerAccountEntry,
): AppData {
  data = reconcileCustomerAccounts(data);
  if ((data.customerEntries || []).some((record) => record.id === entry.id))
    return data;
  const customer = data.customers.find(
    (record) => record.id === entry.customerId,
  );
  if (!customer)
    throw new Error(
      "This customer could not be found. Reopen their account and try again.",
    );
  const amount = accountAmount(entry.amount);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > Number.MAX_SAFE_INTEGER / 100
  )
    throw new Error("Enter a valid amount greater than zero.");
  if (entry.kind !== "opening_balance" && entry.kind !== "payment")
    throw new Error("Choose a valid account transaction.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
    Number.isNaN(Date.parse(entry.date)) ||
    new Date(entry.date).toISOString().slice(0, 10) !== entry.date
  )
    throw new Error("Choose a valid transaction date.");
  if (entry.kind === "payment") {
    if (amount > customer.balance)
      throw new Error(
        "The payment exceeds the current outstanding balance. Check the amount and try again.",
      );
    if (!entry.method || !methods.has(entry.method))
      throw new Error("Choose how the customer paid.");
  }
  const record = {
    ...entry,
    amount,
    reference: entry.reference?.trim(),
    notes: entry.notes?.trim(),
  };
  return reconcileCustomerAccounts({
    ...data,
    customerEntries: [record, ...(data.customerEntries || [])],
    audit: [
      {
        id: uid(),
        actor: entry.createdBy,
        action:
          entry.kind === "payment"
            ? "Customer payment recorded"
            : "Customer opening balance added",
        record: `${customer.name}: ${amount}${record.reference ? ` (${record.reference})` : ""}`,
        createdAt: entry.createdAt,
      },
      ...data.audit,
    ],
  });
}
