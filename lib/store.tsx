"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppData, CartItem, Expense, Product, Purchase, Sale } from "./types";
import { demoData, now, uid } from "./utils";
import { createReceiptNumber } from "./receipt-number";
import { saveWorkspaceBackup } from "./workspace-backup";
type Ctx = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  ready: boolean;
  role: "owner" | "manager" | "cashier";
  setRole: (r: "owner" | "manager" | "cashier") => void;
  addProduct: (p: Omit<Product, "id" | "createdAt">) => void;
  completeSale: (
    s: Omit<
      Sale,
      "id" | "receiptNo" | "createdAt" | "status" | "synced"
    >,
  ) => Sale;
  addExpense: (e: Omit<Expense, "id">) => void;
  receivePurchase: (p: Omit<Purchase, "id">) => void;
  reset: () => void;
};
const AppContext = createContext<Ctx | null>(null);
const KEY = "nilestock.v3.clean";
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<AppData>(demoData());
  const dataRef = useRef(data);
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"owner" | "manager" | "cashier">("owner");

  const persistImmediately = useCallback((next: AppData) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      const businessId = localStorage.getItem("nilestock.cloud.businessId");
      if (businessId) saveWorkspaceBackup(businessId, next);
    } catch {
      // React state remains authoritative if browser storage is unavailable.
    }
  }, []);

  const commitData = useCallback<React.Dispatch<React.SetStateAction<AppData>>>(
    (update) => {
      const current = dataRef.current;
      const next =
        typeof update === "function"
          ? (update as (previous: AppData) => AppData)(current)
          : update;
      dataRef.current = next;
      persistImmediately(next);
      setDataState(next);
    },
    [persistImmediately],
  );

  useEffect(() => {
    try {
      const x = localStorage.getItem(KEY);
      if (x) {
        const restored = JSON.parse(x) as AppData;
        dataRef.current = restored;
        setDataState(restored);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    dataRef.current = data;
    if (ready) persistImmediately(data);
  }, [data, persistImmediately, ready]);
  const api = useMemo<Ctx>(
    () => ({
      data,
      setData: commitData,
      ready,
      role,
      setRole,
      addProduct: (p) =>
        commitData((d) => {
          const product = { ...p, id: uid(), createdAt: now() };
          return {
            ...d,
            products: [product, ...d.products],
            movements: [
              {
                id: uid(),
                productId: product.id,
                productName: product.name,
                type: "Opening balance",
                quantity: product.stock,
                reference: "PRODUCT-CREATE",
                user: "Owner",
                createdAt: now(),
              },
              ...d.movements,
            ],
            audit: [
              {
                id: uid(),
                actor: "Owner",
                action: "Product created",
                record: product.name,
                createdAt: now(),
              },
              ...d.audit,
            ],
          };
        }),
      completeSale: (s) => {
        const createdAt = now();
        const sale: Sale = {
          ...s,
          id: uid(),
          receiptNo: createReceiptNumber(
            createdAt,
            data.sales.map((existing) => existing.receiptNo),
          ),
          createdAt,
          cashier: s.cashier.trim(),
          status: "completed",
          synced: false,
        };
        commitData((d) => ({
          ...d,
          products: d.products.map((p) => {
            const line = s.items.find((i) => i.productId === p.id);
            return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
          }),
          sales: [sale, ...d.sales],
          movements: [
            ...s.items.map((i) => ({
              id: uid(),
              productId: i.productId,
              productName: i.name,
              type: "Sale",
              quantity: -i.qty,
              reference: sale.receiptNo,
              user: sale.cashier,
              createdAt: sale.createdAt,
            })),
            ...d.movements,
          ],
          customers: d.customers.map((c) =>
            c.id === s.customerId
              ? {
                  ...c,
                  total: c.total + s.total,
                  balance:
                    c.balance + (s.payment === "Customer Credit" ? s.total : 0),
                  lastActivity: sale.createdAt,
                }
              : c,
          ),
          audit: [
            {
              id: uid(),
              actor: sale.cashier,
              action: "Sale completed",
              record: sale.receiptNo,
              createdAt: sale.createdAt,
            },
            ...d.audit,
          ],
        }));
        return sale;
      },
      addExpense: (e) =>
        commitData((d) => ({
          ...d,
          expenses: [{ ...e, id: uid() }, ...d.expenses],
          audit: [
            {
              id: uid(),
              actor: "Owner",
              action: "Expense recorded",
              record: e.description,
              createdAt: now(),
            },
            ...d.audit,
          ],
        })),
      receivePurchase: (p) =>
        commitData((d) => {
          const purchase = { ...p, id: uid() };
          return {
            ...d,
            purchases: [purchase, ...d.purchases],
            products: d.products.map((x) => {
              const i = p.items.find((i) => i.productId === x.id);
              return i ? { ...x, stock: x.stock + i.qty, cost: i.cost } : x;
            }),
            movements: [
              ...p.items.map((i) => ({
                id: uid(),
                productId: i.productId,
                productName: i.name,
                type: "Purchase",
                quantity: i.qty,
                reference: p.reference,
                user: "Owner",
                createdAt: now(),
              })),
              ...d.movements,
            ],
            suppliers: d.suppliers.map((s) =>
              s.id === p.supplierId
                ? {
                    ...s,
                    total: s.total + p.total,
                    balance: s.balance + (p.total - p.paid),
                    lastActivity: p.date,
                  }
                : s,
            ),
            audit: [
              {
                id: uid(),
                actor: "Owner",
                action: "Purchase received",
                record: p.reference,
                createdAt: now(),
              },
              ...d.audit,
            ],
          };
        }),
      reset: () => commitData(demoData()),
    }),
    [commitData, data, ready, role],
  );
  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}
export const useApp = () => {
  const c = useContext(AppContext);
  if (!c) throw new Error("AppProvider missing");
  return c;
};
