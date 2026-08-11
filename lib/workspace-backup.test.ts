import { describe, expect, it } from "vitest";
import { demoData } from "./utils";
import {
  parseLegacyWorkspace,
  parseWorkspaceBackup,
  selectNewestWorkspace,
  workspaceBackupKey,
} from "./workspace-backup";

describe("workspace backup recovery", () => {
  it("keeps a newer local workspace when the cloud copy is stale", () => {
    const cloud = demoData();
    const local = demoData();
    local.products.push({
      id: "restored-product",
      name: "OPIO TITUS",
      description: "",
      category: "General",
      price: 3_673,
      cost: 0,
      sku: "NS-216400",
      barcode: "246281216400",
      qr: "NS:246281216400",
      stock: 6,
      reorder: 2,
      unit: "piece",
      taxable: false,
      active: true,
      createdAt: "2026-08-09T12:00:00.000Z",
    });

    const selected = selectNewestWorkspace({
      cloudPayload: cloud,
      cloudUpdatedAt: "2026-08-09T12:00:00.000Z",
      localBackup: {
        savedAt: "2026-08-09T12:01:00.000Z",
        payload: local,
      },
    });

    expect(selected.source).toBe("local");
    expect(selected.payload?.products[0].name).toBe("OPIO TITUS");
  });

  it("uses the cloud workspace when it is newer", () => {
    const cloud = demoData();
    const local = demoData();
    const selected = selectNewestWorkspace({
      cloudPayload: cloud,
      cloudUpdatedAt: "2026-08-09T12:02:00.000Z",
      localBackup: {
        savedAt: "2026-08-09T12:01:00.000Z",
        payload: local,
      },
    });

    expect(selected.source).toBe("cloud");
    expect(workspaceBackupKey("business-1")).toContain("business-1");
  });

  it("rejects malformed backups", () => {
    expect(parseWorkspaceBackup("not-json")).toBeNull();
    expect(parseWorkspaceBackup('{"savedAt":"today","payload":{}}')).toBeNull();
  });

  it("recovers a matching legacy account without crossing businesses", () => {
    const legacy = demoData();
    legacy.business.name = "Tytus Shop";
    legacy.business.email = "owner@example.com";
    expect(
      parseLegacyWorkspace(
        JSON.stringify(legacy),
        "owner@example.com",
        "Tytus Shop",
      ),
    ).toEqual(legacy);
    expect(
      parseLegacyWorkspace(
        JSON.stringify(legacy),
        "different@example.com",
        "Different Shop",
      ),
    ).toBeNull();
  });
});
