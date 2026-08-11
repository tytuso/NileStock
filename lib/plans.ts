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
    copy: "Try the essentials",
    summary: "A clean starting point for a small counter.",
    features: [
      "Up to 10 products",
      "Fast POS and printable receipts",
      "Latest 20 receipts kept on device",
      "Live dashboard and readable reports",
      "Single owner workspace",
    ],
    popular: false,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 25000,
    copy: "For a growing shop",
    summary: "Remove product limits and manage daily stock faster.",
    features: [
      "Everything in Free",
      "Unlimited products",
      "Inventory, barcode and QR downloads",
      "Latest 20 receipts kept on device",
      "Customer requests and WhatsApp receipts",
    ],
    popular: false,
  },
  business: {
    id: "business",
    name: "Business",
    price: 50000,
    copy: "Complete retail operations",
    summary: "Control staff, suppliers, credit and multi-step operations.",
    features: [
      "Everything in Starter",
      "Staff accounts and cashier shifts",
      "Customer credit and supplier control",
      "Branded PDF reports, purchases and CSV exports",
      "Latest 50 receipts kept on device",
    ],
    popular: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 100000,
    copy: "Intelligence and automation",
    summary: "Turn live shop data into reports, decisions and next actions.",
    features: [
      "Everything in Business",
      "NileStock AI Business Adviser",
      "Business evaluation and product opportunities",
      "Strategic insights grounded in live shop data",
      "Latest 100 receipts kept on device",
    ],
    popular: false,
  },
};

export const isProPlan = (plan: PlanId) => plan === "pro";
export const planLevel = (plan: PlanId) => PLAN_ORDER.indexOf(plan);
export const hasMinimumPlan = (plan: PlanId, minimum: PlanId) =>
  planLevel(plan) >= planLevel(minimum);

export const receiptHistoryLimit = (plan: PlanId) => {
  if (plan === "pro") return 100;
  if (plan === "business") return 50;
  return 20;
};

export const PLAN_ACCESS = [
  { label: "Core POS and receipts", minimum: "free" as PlanId },
  { label: "Live reports on screen", minimum: "free" as PlanId },
  { label: "Unlimited products and code printing", minimum: "starter" as PlanId },
  { label: "Staff, shifts, suppliers and credit", minimum: "business" as PlanId },
  { label: "CSV operational exports", minimum: "business" as PlanId },
  { label: "PDF report downloads and WhatsApp sharing", minimum: "business" as PlanId },
  { label: "AI business evaluation and strategy", minimum: "pro" as PlanId },
];
