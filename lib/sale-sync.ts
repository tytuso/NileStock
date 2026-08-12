import type { AppData, CartItem, PaymentMethod, Sale } from "./types";

const PAYMENT_METHODS = new Set<PaymentMethod>([
  "Cash",
  "Mobile Money",
  "Card",
  "Bank",
  "Customer Credit",
  "Other",
]);
const SALE_STATUSES = new Set<Sale["status"]>([
  "completed",
  "refunded",
  "voided",
]);

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.productId === "string" &&
    typeof item.name === "string" &&
    isNumber(item.price) &&
    (item.originalPrice === undefined || isNumber(item.originalPrice)) &&
    (item.negotiated === undefined || typeof item.negotiated === "boolean") &&
    isNumber(item.cost) &&
    isNumber(item.qty) &&
    isNumber(item.discount)
  );
}

export function parseCloudSale(value: unknown): Sale | null {
  if (!value || typeof value !== "object") return null;
  const sale = value as Partial<Sale>;
  if (
    typeof sale.id !== "string" ||
    typeof sale.receiptNo !== "string" ||
    typeof sale.createdAt !== "string" ||
    Number.isNaN(Date.parse(sale.createdAt)) ||
    typeof sale.cashier !== "string" ||
    !Array.isArray(sale.items) ||
    !sale.items.every(isCartItem) ||
    !isNumber(sale.subtotal) ||
    !isNumber(sale.discount) ||
    !isNumber(sale.tax) ||
    !isNumber(sale.total) ||
    !isNumber(sale.paid) ||
    !isNumber(sale.change) ||
    !PAYMENT_METHODS.has(sale.payment as PaymentMethod) ||
    !SALE_STATUSES.has(sale.status as Sale["status"])
  )
    return null;

  return { ...(sale as Sale), synced: true };
}

function comparableSale(sale: Sale) {
  const { synced: _synced, ...payload } = sale;
  return payload;
}

function salesMatch(left: Sale, right: Sale) {
  return (
    JSON.stringify(comparableSale(left)) ===
    JSON.stringify(comparableSale(right))
  );
}

export function salesSyncFingerprint(sales: Sale[]) {
  return JSON.stringify(
    [...sales]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(comparableSale),
  );
}

export function buildCloudSaleRows(
  sales: Sale[],
  businessId: string,
  userId: string,
  updatedAt = new Date().toISOString(),
) {
  return sales.map((sale) => ({
    business_id: businessId,
    id: sale.id,
    payload: { ...sale, synced: true },
    created_at: sale.createdAt,
    updated_by: userId,
    updated_at: updatedAt,
  }));
}

export function markSalesSynced(data: AppData, saleIds: Set<string>) {
  if (!data.sales.some((sale) => saleIds.has(sale.id) && !sale.synced))
    return data;
  return {
    ...data,
    sales: data.sales.map((sale) =>
      saleIds.has(sale.id) ? { ...sale, synced: true } : sale,
    ),
  };
}

export function mergeCloudSales(data: AppData, payloads: unknown[]) {
  const remoteById = new Map<string, Sale>();
  for (const payload of payloads) {
    const sale = parseCloudSale(payload);
    if (sale) remoteById.set(sale.id, sale);
  }
  if (!remoteById.size) return data;

  const stockDelta = new Map<string, number>();
  const movements = [...data.movements];
  const audit = [...data.audit];
  let changed = false;

  const addStockDelta = (sale: Sale, multiplier: number) => {
    for (const item of sale.items)
      stockDelta.set(
        item.productId,
        (stockDelta.get(item.productId) || 0) + item.qty * multiplier,
      );
  };

  const sales = data.sales.map((localSale) => {
    const remoteSale = remoteById.get(localSale.id);
    if (!remoteSale) return localSale;
    remoteById.delete(localSale.id);

    if (!localSale.synced) return localSale;
    if (salesMatch(localSale, remoteSale) && localSale.synced) return localSale;

    if (localSale.status === "completed" && remoteSale.status !== "completed") {
      addStockDelta(localSale, 1);
      movements.unshift(
        ...remoteSale.items.map((item) => ({
          id: `cloud-return-${remoteSale.id}-${item.productId}`,
          productId: item.productId,
          productName: item.name,
          type: "Return",
          quantity: item.qty,
          reference: remoteSale.receiptNo,
          user: remoteSale.cashier,
          createdAt: remoteSale.createdAt,
          notes: "Synced from another device",
        })),
      );
    } else if (
      localSale.status !== "completed" &&
      remoteSale.status === "completed"
    ) {
      addStockDelta(remoteSale, -1);
    }
    audit.unshift({
      id: `cloud-sale-update-${remoteSale.id}-${remoteSale.status}`,
      actor: remoteSale.cashier,
      action: "Sale updated from another device",
      record: remoteSale.receiptNo,
      createdAt: remoteSale.createdAt,
    });
    changed = true;
    return remoteSale;
  });

  const missingSales = [...remoteById.values()];
  for (const sale of missingSales) {
    changed = true;
    if (sale.status === "completed") addStockDelta(sale, -1);

    movements.unshift(
      ...sale.items.map((item) => ({
        id: `cloud-sale-${sale.id}-${item.productId}`,
        productId: item.productId,
        productName: item.name,
        type: "Sale",
        quantity: -item.qty,
        reference: sale.receiptNo,
        user: sale.cashier,
        createdAt: sale.createdAt,
        notes: "Synced from another device",
      })),
    );
    if (sale.status === "refunded")
      movements.unshift(
        ...sale.items.map((item) => ({
          id: `cloud-return-${sale.id}-${item.productId}`,
          productId: item.productId,
          productName: item.name,
          type: "Return",
          quantity: item.qty,
          reference: sale.receiptNo,
          user: sale.cashier,
          createdAt: sale.createdAt,
          notes: "Synced from another device",
        })),
      );
    audit.unshift({
      id: `cloud-sale-${sale.id}`,
      actor: sale.cashier,
      action: "Sale synced from another device",
      record: sale.receiptNo,
      createdAt: sale.createdAt,
    });
  }

  if (!changed) return data;

  const customerTotals = new Map<
    string,
    { total: number; credit: number; at: string }
  >();
  for (const sale of missingSales) {
    if (!sale.customerId) continue;
    const current = customerTotals.get(sale.customerId) || {
      total: 0,
      credit: 0,
      at: sale.createdAt,
    };
    current.total += sale.total;
    if (sale.payment === "Customer Credit") current.credit += sale.total;
    if (sale.createdAt > current.at) current.at = sale.createdAt;
    customerTotals.set(sale.customerId, current);
  }

  return {
    ...data,
    products: data.products.map((product) => ({
      ...product,
      stock: Math.max(0, product.stock + (stockDelta.get(product.id) || 0)),
    })),
    sales: [...sales, ...missingSales].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
    movements,
    audit,
    customers: data.customers.map((customer) => {
      const totals = customerTotals.get(customer.id);
      return totals
        ? {
            ...customer,
            total: customer.total + totals.total,
            balance: customer.balance + totals.credit,
            lastActivity: totals.at,
          }
        : customer;
    }),
  };
}
