import { describe, expect, it } from "vitest";
import { OFFLINE_PAID_LEASE_MS, parseOfflineEntitlement, resolveOfflineAccess } from "./offline-entitlement";

describe("offline paid entitlement lease", () => {
  it("keeps Free available offline indefinitely", () => {
    expect(resolveOfflineAccess("free", null, 99).restricted).toBe(false);
  });
  it("keeps a paid plan inside the seven-day lease", () => {
    const verifiedAt = 1_000;
    const result = resolveOfflineAccess("business", { plan: "business", status: "active", verifiedAt }, verifiedAt + OFFLINE_PAID_LEASE_MS - 1);
    expect(result.restricted).toBe(false);
    expect(result.effectivePlan).toBe("business");
  });
  it("falls back to Free access after a paid lease expires", () => {
    const verifiedAt = 1_000;
    const result = resolveOfflineAccess("pro", { plan: "pro", status: "active", verifiedAt }, verifiedAt + OFFLINE_PAID_LEASE_MS + 1);
    expect(result.restricted).toBe(true);
    expect(result.effectivePlan).toBe("free");
  });
  it("rejects malformed cache data", () => {
    expect(parseOfflineEntitlement('{"plan":"pro"}')).toBeNull();
  });
});
