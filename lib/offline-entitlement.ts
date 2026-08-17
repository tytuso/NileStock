import type { PlanId } from "./plans";

export const OFFLINE_PAID_LEASE_DAYS = 7;
export const OFFLINE_PAID_LEASE_MS = OFFLINE_PAID_LEASE_DAYS * 24 * 60 * 60 * 1000;

export type OfflineEntitlement = {
  plan: PlanId;
  status: "active" | "revoked";
  verifiedAt: number;
  lastSeenAt?: number;
};

export const entitlementKey = (businessId: string) =>
  `nilestock.entitlement.${businessId}`;

export function parseOfflineEntitlement(raw: string | null): OfflineEntitlement | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OfflineEntitlement>;
    if (
      !["free", "starter", "business", "pro"].includes(String(value.plan)) ||
      !["active", "revoked"].includes(String(value.status)) ||
      !Number.isFinite(value.verifiedAt)
    )
      return null;
    return {
      plan: value.plan as PlanId,
      status: value.status as "active" | "revoked",
      verifiedAt: Number(value.verifiedAt),
      lastSeenAt: Number.isFinite(value.lastSeenAt)
        ? Number(value.lastSeenAt)
        : Number(value.verifiedAt),
    };
  } catch {
    return null;
  }
}

export function resolveOfflineAccess(
  workspacePlan: PlanId,
  entitlement: OfflineEntitlement | null,
  now = Date.now(),
) {
  if (workspacePlan === "free")
    return {
      restricted: false,
      effectivePlan: "free" as PlanId,
      sourcePlan: "free" as PlanId,
      expiresAt: null as number | null,
      reason: "free" as const,
    };
  if (!entitlement)
    return {
      restricted: true,
      effectivePlan: "free" as PlanId,
      sourcePlan: workspacePlan,
      expiresAt: null as number | null,
      reason: "missing" as const,
    };
  const sourcePlan = entitlement.plan === "free" ? workspacePlan : entitlement.plan;
  const monotonicNow = Math.max(now, entitlement.lastSeenAt || 0);
  const expiresAt = entitlement.verifiedAt + OFFLINE_PAID_LEASE_MS;
  const restricted = entitlement.status !== "active" || monotonicNow > expiresAt;
  return {
    restricted,
    effectivePlan: restricted ? ("free" as PlanId) : sourcePlan,
    sourcePlan,
    expiresAt,
    reason: entitlement.status === "revoked"
      ? ("revoked" as const)
      : restricted
        ? ("expired" as const)
        : ("active" as const),
  };
}
