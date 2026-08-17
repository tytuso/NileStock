export type PlanId = "free" | "starter" | "business" | "pro";

export const PLAN_ORDER: PlanId[] = ["free", "starter", "business", "pro"];

export const PLAN_DEFINITIONS: Record<
  PlanId,
  {
    id: PlanId;
    name: string;
    price: number;
    copy: string;
    summary: string;
    features: string[];
    popular: boolean;
  }
> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    copy: "Start without risk",
    summary: "A permanent free counter for testing NileStock with a small catalogue.",
    features: [
      "Up to 10 products",
      "Fast POS and printable receipts",
      "Phone, tablet and desktop access",
      "Offline sales after first setup",
      "Readable live reports",
    ],
    popular: false,
  },
  starter: {
    id: "starter",
    name: "Lite",
    price: 9500,
    copy: "For micro and small shops",
    summary: "A low-cost daily POS with more products, codes and customer-ready receipts.",
    features: [
      "Everything in Free",
      "Up to 100 products",
      "Barcode and QR downloads",
      "WhatsApp receipt sharing",
      "Automatic cloud sync when back online",
    ],
    popular: true,
  },
  business: {
    id: "business",
    name: "Business",
    price: 49500,
    copy: "Complete retail control",
    summary: "For growing stores that need unlimited products, staff control and polished reports.",
    features: [
      "Everything in Lite",
      "Unlimited products",
      "Staff roles and cashier shifts",
      "Customer credit, suppliers and purchases",
      "Branded PDF reports and CSV exports",
      "Latest 50 receipts kept on device",
    ],
    popular: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 99500,
    copy: "Intelligence and automation",
    summary: "For serious retailers that want complete operations plus AI-guided decisions.",
    features: [
      "Everything in Business",
      "NileStock AI Business Adviser",
      "Business evaluation and product opportunities",
      "Strategic insights grounded in live shop data",
      "Priority support",
      "Latest 100 receipts kept on device",
    ],
    popular: false,
  },
};

export const isProPlan = (plan: PlanId) => plan === "pro";
export const planLevel = (plan: PlanId) => PLAN_ORDER.indexOf(plan);
export const hasMinimumPlan = (plan: PlanId, minimum: PlanId) =>
  planLevel(plan) >= planLevel(minimum);

export const productLimit = (plan: PlanId): number | null => {
  if (plan === "free") return 10;
  if (plan === "starter") return 100;
  return null;
};

export const receiptHistoryLimit = (plan: PlanId) => {
  if (plan === "pro") return 100;
  if (plan === "business") return 50;
  return 20;
};

export const PLAN_ACCESS = [
  { label: "Core POS, receipts and offline selling", minimum: "free" as PlanId },
  { label: "Readable live reports", minimum: "free" as PlanId },
  { label: "Up to 100 products and code printing", minimum: "starter" as PlanId },
  { label: "Unlimited products", minimum: "business" as PlanId },
  { label: "Staff, shifts, suppliers and credit", minimum: "business" as PlanId },
  { label: "CSV and branded PDF report exports", minimum: "business" as PlanId },
  { label: "AI business evaluation and strategy", minimum: "pro" as PlanId },
];
