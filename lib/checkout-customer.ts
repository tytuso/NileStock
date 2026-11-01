import type { Contact } from "./types";

/** Resolve a customer before checkout; the caller commits the new profile and sale together. */
export function resolveCheckoutCustomer(
  customers: Contact[],
  input: { customerId?: string; newCustomerName?: string },
  createdAt: string,
  makeId: () => string,
): { customerId?: string; customerName?: string; newCustomer: Contact | null } {
  const name = (input.newCustomerName || "").trim().replace(/\s+/g, " ");
  if (name.length > 120) throw new Error("Customer names must be 120 characters or fewer.");
  if (input.customerId) {
    if (name) throw new Error("Select a saved customer or enter a new name, not both.");
    const selected = customers.find((customer) => customer.id === input.customerId);
    if (!selected) throw new Error("That customer is no longer available. Please select them again.");
    return { customerId: selected.id, customerName: selected.name, newCustomer: null };
  }
  if (!name) return { newCustomer: null };
  if (customers.some((customer) =>
    customer.name.trim().replace(/\s+/g, " ").toLocaleLowerCase() === name.toLocaleLowerCase()
  )) throw new Error("This customer is already saved. Select them from the existing customers list.");
  const newCustomer: Contact = {
    id: makeId(),
    name,
    phone: "",
    total: 0,
    balance: 0,
    accountBaseline: { total: 0, balance: 0 },
    lastActivity: createdAt,
  };
  return { customerId: newCustomer.id, customerName: newCustomer.name, newCustomer };
}
