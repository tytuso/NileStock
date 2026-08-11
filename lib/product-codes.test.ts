import { describe, expect, it } from "vitest";
import type { Product } from "./types";
import { findProductByCode } from "./product-codes";

const product = {
  id: "p1",
  name: "Rice",
  category: "Food",
  price: 5_000,
  cost: 3_000,
  sku: "NS-RICE",
  barcode: "34546756",
  qr: "NS:34546756",
  stock: 4,
  reorder: 2,
  unit: "bag",
  taxable: false,
  active: true,
  createdAt: new Date().toISOString(),
} satisfies Product;

describe("barcode lookup", () => {
  it("accepts barcode, QR or case-insensitive SKU with surrounding spaces", () => {
    expect(findProductByCode([product], " 34546756 ")?.id).toBe("p1");
    expect(findProductByCode([product], "NS:34546756")?.id).toBe("p1");
    expect(findProductByCode([product], "ns-rice")?.id).toBe("p1");
  });

  it("rejects blank and incorrect codes", () => {
    expect(findProductByCode([product], " ")).toBeUndefined();
    expect(findProductByCode([product], "34546757")).toBeUndefined();
  });
});
